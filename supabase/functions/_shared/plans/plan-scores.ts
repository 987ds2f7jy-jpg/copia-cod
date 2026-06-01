export type ExternalPlanScore = {
  subscription_score_id?: number | string | null;
  score_id?: number | string | null;
  status?: number | string | null;
  status_label?: string | null;
  specialization_id?: number | string | null;
  specialization_name?: string | null;
  concil_type?: string | null;
  created_at?: string | null;
  used_at?: string | null;
};

export type ExternalPlanScoresSubscription = {
  id?: number | string | null;
  plan_id?: number | string | null;
  plan_name?: string | null;
  status?: number | string | null;
  status_label?: string | null;
  created_at?: string | null;
  scores?: ExternalPlanScore[] | null;
};

export type AggregatedPlanCredit = {
  id: string;
  code: string;
  label: string;
  included: boolean;
  available: number;
  used: number;
  disabled: number;
  total: number;
  source: 'plans_service';
  specializationId: number | string | null;
  scoreIds: Array<number | string>;
  subscriptionScoreIds: Array<number | string>;
};

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeStatusLabel(value: unknown) {
  return normalizeString(value).toLowerCase();
}

function toSafeCode(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'score';
}

function firstDefined<TValue>(...values: TValue[]) {
  return values.find((value) => value !== undefined && value !== null && normalizeString(value) !== '');
}

function scoreIdentity(score: ExternalPlanScore) {
  const specializationId = firstDefined(score.specialization_id);
  const specializationName = normalizeString(score.specialization_name);
  const scoreId = firstDefined(score.score_id);
  const label = specializationName || (scoreId ? `Score ${scoreId}` : 'Credito do plano');
  const code = specializationName
    ? toSafeCode(specializationName)
    : scoreId
      ? `score_${scoreId}`
      : 'score';

  return {
    key: specializationId ? `specialization:${specializationId}` : code,
    code,
    label,
    specializationId: specializationId ?? null,
  };
}

export function aggregateExternalScoresForCredits(
  subscriptions: ExternalPlanScoresSubscription[] = [],
): AggregatedPlanCredit[] {
  const groups = new Map<string, AggregatedPlanCredit>();

  for (const subscription of subscriptions) {
    for (const score of subscription.scores || []) {
      const identity = scoreIdentity(score);
      const existing = groups.get(identity.key) || {
        id: identity.code,
        code: identity.code,
        label: identity.label,
        included: true,
        available: 0,
        used: 0,
        disabled: 0,
        total: 0,
        source: 'plans_service' as const,
        specializationId: identity.specializationId,
        scoreIds: [],
        subscriptionScoreIds: [],
      };
      const statusLabel = normalizeStatusLabel(score.status_label);

      if (statusLabel === 'available') {
        existing.available += 1;
        existing.total += 1;
      } else if (statusLabel === 'used') {
        existing.used += 1;
        existing.total += 1;
      } else if (statusLabel === 'disabled') {
        existing.disabled += 1;
        existing.total += 1;
      }

      const scoreId = firstDefined(score.score_id);
      const subscriptionScoreId = firstDefined(score.subscription_score_id);

      if (scoreId && !existing.scoreIds.includes(scoreId)) {
        existing.scoreIds.push(scoreId);
      }

      if (subscriptionScoreId && !existing.subscriptionScoreIds.includes(subscriptionScoreId)) {
        existing.subscriptionScoreIds.push(subscriptionScoreId);
      }

      groups.set(identity.key, existing);
    }
  }

  return [...groups.values()].filter((credit) => credit.total > 0);
}
