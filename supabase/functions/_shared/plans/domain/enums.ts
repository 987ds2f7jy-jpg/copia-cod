import type {
  NormalizedSubscriptionScoreStatus,
  NormalizedSubscriptionStatus,
} from '../contracts/types.ts';

export const PLAN_STATUS = { active: 1, inactive: 2 } as const;
export const SUBSCRIPTION_STATUS = { active: 1, inactive: 2, cancelled: 3, pending: 4 } as const;
export const SUBSCRIPTION_SCORE_STATUS = { enable: 1, used: 2, disable: 3 } as const;
export const USER_EXTERNAL_ACCESS_STATUS = { active: 1, blocked: 2 } as const;

export function normalizeSubscriptionStatus(value: unknown): NormalizedSubscriptionStatus {
  switch (Number(value)) {
    case SUBSCRIPTION_STATUS.active: return 'active';
    case SUBSCRIPTION_STATUS.inactive: return 'inactive';
    case SUBSCRIPTION_STATUS.cancelled: return 'cancelled';
    default: return 'pending';
  }
}

export function normalizeSubscriptionScoreStatus(value: unknown): NormalizedSubscriptionScoreStatus {
  switch (Number(value)) {
    case SUBSCRIPTION_SCORE_STATUS.enable: return 'available';
    case SUBSCRIPTION_SCORE_STATUS.used: return 'used';
    default: return 'disabled';
  }
}

