import type {
  ActivatePlanSubscriptionInput,
  ActivatePlanSubscriptionResult,
  PlanCode,
} from '../../contracts/types.ts';
import type { InternalPlansRepository } from '../repositories/InternalPlansRepository.ts';

function text(value: unknown) {
  return String(value ?? '').trim();
}

export class PlanSubscriptionService {
  constructor(private readonly repository: InternalPlansRepository) {}

  async activate(input: ActivatePlanSubscriptionInput): Promise<ActivatePlanSubscriptionResult> {
    const raw = await this.repository.activate(input);

    return {
      backend: 'internal',
      created: Boolean(raw.created),
      activationId: text(raw.activation_id),
      planCode: text(raw.plan_code) as PlanCode,
      legacyPlanId: Number(raw.legacy_plan_id),
      subscriptionId: text(raw.subscription_id),
      externalKey: text(raw.external_key),
      rawStatus: Number(raw.raw_status),
      status: text(raw.status) as ActivatePlanSubscriptionResult['status'],
      paymentVerifiedAt: text(raw.payment_verified_at) || null,
      activatedAt: text(raw.activated_at) || null,
      raw,
    };
  }
}

