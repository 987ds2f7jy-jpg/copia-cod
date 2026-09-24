export type PlansBackend = 'external' | 'internal';
export type PlanCode = 'psychology' | 'weight_loss' | 'family';

export type NormalizedSubscriptionStatus = 'active' | 'inactive' | 'cancelled' | 'pending';
export type NormalizedSubscriptionScoreStatus = 'available' | 'used' | 'disabled';

export type ActivatePlanSubscriptionInput = {
  planSubscriptionOrderId: string;
  paymentChargeId: string;
  externalKey: string;
  planCode: PlanCode;
  paidAt: string;
  customer?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type ActivatePlanSubscriptionResult = {
  backend: PlansBackend;
  created: boolean;
  activationId: string;
  planCode: PlanCode;
  legacyPlanId: number;
  subscriptionId: string;
  externalKey: string;
  rawStatus: number | string;
  status: NormalizedSubscriptionStatus;
  paymentVerifiedAt: string | null;
  activatedAt: string | null;
  raw?: unknown;
};

export type FindAvailableSubscriptionScoreInput = {
  externalKey: string;
  legacyPlanId: number;
  legacySpecializationId: number;
};

export type AvailableSubscriptionScore = {
  backend: PlansBackend;
  planCode: PlanCode;
  legacyPlanId: number;
  subscriptionId: string;
  subscriptionScoreId: string;
  scoreId: string;
  legacySpecializationId: number;
  specializationCode: string;
  concilType: string;
  externalKey: string;
  rawStatus: number | string;
  status: 'available';
  createdAt: string | null;
  raw?: unknown;
};

export type UseSubscriptionScoreInput = {
  subscriptionScoreId: string;
};

export type UseSubscriptionScoreResult = {
  backend: PlansBackend;
  outcome: 'used_now' | 'already_used';
  subscriptionId: string;
  subscriptionScoreId: string;
  scoreId: string;
  rawStatus: number | string;
  status: 'used';
  usedAt: string | null;
  raw?: unknown;
};

export type NormalizedSubscriptionScore = {
  subscriptionScoreId: string;
  scoreId: string;
  rawStatus: number | string;
  status: NormalizedSubscriptionScoreStatus;
  legacySpecializationId: number;
  specializationName: string;
  specializationCode: string;
  concilType: string;
  createdAt: string | null;
  usedAt: string | null;
};

export type NormalizedPlanSubscription = {
  id: string;
  legacyPlanId: number;
  planCode: PlanCode;
  planName: string;
  rawStatus: number | string;
  status: NormalizedSubscriptionStatus;
  createdAt: string | null;
  scores: NormalizedSubscriptionScore[];
};

export type ListSubscriptionScoresInput = {
  externalKey: string;
  subscriptionId?: string | null;
};

export type ListSubscriptionScoresResult = {
  backend: PlansBackend;
  externalKey: string;
  subscriptions: NormalizedPlanSubscription[];
  raw?: unknown;
};

export type AddFamilyPlanMemberInput = {
  subscriptionId: string;
  holderExternalKey: string;
  memberExternalKey: string;
};

export type FamilyPlanMemberResult = {
  backend: PlansBackend;
  memberId: string;
  subscriptionId: string;
  holderExternalKey: string;
  memberExternalKey: string;
  createdAt: string | null;
  raw?: unknown;
};

export type ConsumeInternalPlanCreditInput = {
  subscriptionScoreId: string;
  usageId: string;
  ownerType: 'appointment' | 'queue';
  ownerId: string;
  requestSnapshot?: Record<string, unknown>;
  responseSnapshot?: Record<string, unknown>;
};

