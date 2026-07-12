import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { findAppUserByAuthUserId } from '../_shared/appUsers.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  GetPaymentStatusRepository,
  PaymentChargeRecord,
  PaymentOwnerRecord,
  PaymentOwnerType,
} from './types.ts';

const SUPPORTED_OWNER_TYPES = new Set<PaymentOwnerType>([
  'appointment',
  'queue',
  'solicitacao_exame',
  'plan_subscription',
]);

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

async function findPaymentChargeById(
  client: SupabaseClient,
  chargeId: string,
): Promise<PaymentChargeRecord | null> {
  const { data, error } = await client
    .from('payment_charges')
    .select('id, owner_type, owner_id, status, updated_at')
    .eq('id', chargeId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_CHARGE_LOOKUP_FAILED',
      message: 'Unable to load payment charge.',
      details: error.message,
    });
  }

  const ownerType = normalizeString(data?.owner_type) as PaymentOwnerType;

  if (!data?.id || !SUPPORTED_OWNER_TYPES.has(ownerType)) {
    return null;
  }

  return {
    id: data.id,
    ownerType,
    ownerId: normalizeString(data.owner_id),
    status: normalizeString(data.status) || 'payment_pending',
    updatedAt: normalizeString(data.updated_at),
  };
}

function mapOwnerRow(row: Record<string, unknown> | null, patientField: string): PaymentOwnerRecord | null {
  if (!row?.id) {
    return null;
  }

  return {
    id: normalizeString(row.id),
    patientId: normalizeString(row[patientField] || row.app_user_id || row.patient_id || row.paciente_id),
    currentPaymentChargeId: normalizeString(row.current_payment_charge_id) || null,
    paymentStatus: normalizeString(row.payment_status),
    operationalStatus: normalizeString(row.status),
    consultaId: normalizeString(row.consulta_id) || null,
  };
}

async function findPaymentOwner(
  client: SupabaseClient,
  charge: PaymentChargeRecord,
): Promise<PaymentOwnerRecord | null> {
  const config = charge.ownerType === 'solicitacao_exame'
    ? { table: 'solicitacoes_exames', patientField: 'paciente_id', select: 'id, paciente_id, current_payment_charge_id, payment_status, status' }
    : charge.ownerType === 'plan_subscription'
      ? { table: 'plan_subscription_orders', patientField: 'app_user_id', select: 'id, app_user_id, patient_id, current_payment_charge_id, payment_status, status' }
      : charge.ownerType === 'appointment'
        ? { table: 'appointments', patientField: 'patient_id', select: 'id, patient_id, current_payment_charge_id, payment_status, status, consulta_id' }
        : { table: 'queues', patientField: 'patient_id', select: 'id, patient_id, current_payment_charge_id, payment_status, status' };

  const { data, error } = await client
    .from(config.table)
    .select(config.select)
    .eq('id', charge.ownerId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PAYMENT_OWNER_LOOKUP_FAILED',
      message: 'Unable to load payment resource.',
      details: error.message,
    });
  }

  return mapOwnerRow(data as Record<string, unknown> | null, config.patientField);
}

function createGetPaymentStatusRepository(client: SupabaseClient): GetPaymentStatusRepository {
  return {
    async findAppUserByAuthUserId(authUserId) {
      const appUser = await findAppUserByAuthUserId(client, authUserId);
      return appUser
        ? { id: appUser.id, role: appUser.role, isActive: appUser.isActive }
        : null;
    },
    findPaymentChargeById: (chargeId) => findPaymentChargeById(client, chargeId),
    findPaymentOwner: (charge) => findPaymentOwner(client, charge),
  };
}

export function createGetPaymentStatusRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createGetPaymentStatusRepository(client),
  };
}
