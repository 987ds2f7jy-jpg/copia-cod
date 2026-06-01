import { describe, expect, it } from 'vitest';
import { markPaymentAsPaid } from '../../supabase/functions/_shared/payments/mark-payment-as-paid.ts';

type TableName = 'payment_charges' | 'plan_subscription_orders';

type FakeDatabase = {
  payment_charges: Record<string, Record<string, unknown>>;
  plan_subscription_orders: Record<string, Record<string, unknown>>;
};

function createFakeSupabaseClient(database: FakeDatabase) {
  const updates: Array<{
    table: TableName;
    id: string;
    payload: Record<string, unknown>;
  }> = [];

  return {
    updates,
    from(table: TableName) {
      const query = {
        id: '',
        payload: null as Record<string, unknown> | null,
        select() {
          return this;
        },
        update(payload: Record<string, unknown>) {
          this.payload = payload;
          return this;
        },
        eq(field: string, value: string) {
          if (field === 'id') {
            this.id = value;
          }

          if (this.payload) {
            updates.push({ table, id: this.id, payload: this.payload });
            database[table][this.id] = {
              ...database[table][this.id],
              ...this.payload,
            };

            return { error: null };
          }

          return this;
        },
        maybeSingle() {
          return {
            data: database[table][this.id] || null,
            error: null,
          };
        },
      };

      return query;
    },
  };
}

describe('plan payment idempotency', () => {
  it('does not downgrade an active plan order when processing the same paid charge again', async () => {
    const database: FakeDatabase = {
      payment_charges: {
        'charge-1': {
          id: 'charge-1',
          owner_type: 'plan_subscription',
          owner_id: 'order-1',
          status: 'paid',
          paid_at: '2026-06-01T10:00:00.000Z',
          amount: 199.9,
          currency: 'BRL',
          provider: 'stripe',
          provider_charge_id: 'checkout-session-1',
          provider_payment_reference: 'payment-intent-1',
        },
      },
      plan_subscription_orders: {
        'order-1': {
          id: 'order-1',
          patient_id: 'patient-1',
          app_user_id: 'patient-1',
          plan_code: 'psychology',
          external_plan_id: 1,
          amount: 199.9,
          currency: 'BRL',
          status: 'active',
          payment_status: 'paid',
          current_payment_charge_id: 'charge-1',
          plans_service_subscription_id: 'external-subscription-1',
          external_key: 'patient@example.test',
          paid_at: '2026-06-01T10:00:00.000Z',
        },
      },
    };
    const client = createFakeSupabaseClient(database);

    const result = await markPaymentAsPaid(client as never, { paymentChargeId: 'charge-1' });

    expect(result.activation).toMatchObject({
      skipped: true,
      activated: true,
      status: 'active',
      reason: 'already_active',
      plansServiceSubscriptionId: 'external-subscription-1',
    });
    expect(database.plan_subscription_orders['order-1'].status).toBe('active');
    expect(client.updates).toHaveLength(0);
  });

  it('syncs missing payment fields on active orders without changing status', async () => {
    const database: FakeDatabase = {
      payment_charges: {
        'charge-2': {
          id: 'charge-2',
          owner_type: 'plan_subscription',
          owner_id: 'order-2',
          status: 'paid',
          paid_at: '2026-06-01T11:00:00.000Z',
          amount: 149.9,
          currency: 'BRL',
          provider: 'stripe',
          provider_charge_id: 'checkout-session-2',
          provider_payment_reference: 'payment-intent-2',
        },
      },
      plan_subscription_orders: {
        'order-2': {
          id: 'order-2',
          patient_id: 'patient-2',
          app_user_id: 'patient-2',
          plan_code: 'weight_loss',
          external_plan_id: 2,
          amount: 149.9,
          currency: 'BRL',
          status: 'active',
          payment_status: 'payment_pending',
          current_payment_charge_id: null,
          plans_service_subscription_id: 'external-subscription-2',
          external_key: 'patient-2@example.test',
          paid_at: null,
        },
      },
    };
    const client = createFakeSupabaseClient(database);

    const result = await markPaymentAsPaid(client as never, { paymentChargeId: 'charge-2' });

    expect(result.activation).toMatchObject({
      skipped: true,
      reason: 'already_active',
      plansServiceSubscriptionId: 'external-subscription-2',
    });
    expect(database.plan_subscription_orders['order-2'].status).toBe('active');
    expect(client.updates).toHaveLength(1);
    expect(client.updates[0]).toMatchObject({
      table: 'plan_subscription_orders',
      id: 'order-2',
      payload: {
        payment_status: 'paid',
        current_payment_charge_id: 'charge-2',
        paid_at: '2026-06-01T11:00:00.000Z',
      },
    });
    expect(client.updates[0].payload).not.toHaveProperty('status');
  });
});
