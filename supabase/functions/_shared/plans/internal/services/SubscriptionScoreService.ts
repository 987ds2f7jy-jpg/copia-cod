import type {
  AvailableSubscriptionScore,
  FindAvailableSubscriptionScoreInput,
  ListSubscriptionScoresInput,
  ListSubscriptionScoresResult,
  NormalizedPlanSubscription,
  NormalizedSubscriptionScore,
  PlanCode,
  UseSubscriptionScoreInput,
  UseSubscriptionScoreResult,
} from '../../contracts/types.ts';
import { normalizeSubscriptionScoreStatus, normalizeSubscriptionStatus } from '../../domain/enums.ts';
import type { InternalPlansRepository } from '../repositories/InternalPlansRepository.ts';

function text(value: unknown) { return String(value ?? '').trim(); }
function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
function array(value: unknown) { return Array.isArray(value) ? value : []; }

export class SubscriptionScoreService {
  constructor(private readonly repository: InternalPlansRepository) {}

  async findAvailable(input: FindAvailableSubscriptionScoreInput): Promise<AvailableSubscriptionScore | null> {
    const raw = await this.repository.findAvailable(input);
    if (!raw) return null;

    return {
      backend: 'internal',
      planCode: text(raw.plan_code) as PlanCode,
      legacyPlanId: Number(raw.legacy_plan_id),
      subscriptionId: text(raw.subscription_id),
      subscriptionScoreId: text(raw.subscription_score_id),
      scoreId: text(raw.score_id),
      legacySpecializationId: Number(raw.legacy_specialization_id),
      specializationCode: text(raw.specialization_code),
      concilType: text(raw.concil_type),
      externalKey: text(raw.external_key),
      rawStatus: Number(raw.raw_status),
      status: 'available',
      createdAt: text(raw.created_at) || null,
      raw,
    };
  }

  async use(input: UseSubscriptionScoreInput): Promise<UseSubscriptionScoreResult> {
    const raw = await this.repository.useScore(input);
    return {
      backend: 'internal',
      outcome: text(raw.outcome) as UseSubscriptionScoreResult['outcome'],
      subscriptionId: text(raw.subscription_id),
      subscriptionScoreId: text(raw.subscription_score_id),
      scoreId: text(raw.score_id),
      rawStatus: Number(raw.raw_status),
      status: 'used',
      usedAt: text(raw.used_at) || null,
      raw,
    };
  }

  async list(input: ListSubscriptionScoresInput): Promise<ListSubscriptionScoresResult> {
    const raw = await this.repository.listScores(input);
    const subscriptions = array(raw.subscriptions).map((value): NormalizedPlanSubscription => {
      const subscription = record(value);
      const scores = array(subscription.scores).map((scoreValue): NormalizedSubscriptionScore => {
        const score = record(scoreValue);
        return {
          subscriptionScoreId: text(score.subscription_score_id),
          scoreId: text(score.score_id),
          rawStatus: Number(score.status),
          status: normalizeSubscriptionScoreStatus(score.status),
          legacySpecializationId: Number(score.specialization_id),
          specializationName: text(score.specialization_name),
          specializationCode: text(score.specialization_code),
          concilType: text(score.concil_type),
          createdAt: text(score.created_at) || null,
          usedAt: text(score.used_at) || null,
        };
      });

      return {
        id: text(subscription.id),
        legacyPlanId: Number(subscription.plan_id),
        planCode: text(subscription.plan_code) as PlanCode,
        planName: text(subscription.plan_name),
        rawStatus: Number(subscription.status),
        status: normalizeSubscriptionStatus(subscription.status),
        createdAt: text(subscription.created_at) || null,
        scores,
      };
    });

    return { backend: 'internal', externalKey: text(raw.external_key), subscriptions, raw };
  }
}

