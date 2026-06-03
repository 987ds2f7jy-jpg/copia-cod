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

const PRESENTATION_LABEL_BY_CODE: Record<string, string> = {
  clinica_medica: 'Clínica Médica',
  clinico_geral: 'Clínico Geral',
  nutricao: 'Nutrição',
  educacao_fisica: 'Educação Física',
  psicologia: 'Psicologia',
  psiquiatria: 'Psiquiatria',
  pediatria: 'Pediatria',
  endocrinologia: 'Endocrinologia',
  endocrinologia_e_metabologia: 'Endocrinologia e Metabologia',
};

function toSafeCode(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'score';
}

function displayLabelFor(code: string, fallback: string) {
  return PRESENTATION_LABEL_BY_CODE[code] || fallback || code;
}

function firstDefined<TValue>(...values: TValue[]) {
  return values.find((value) => value !== undefined && value !== null && normalizeString(value) !== '');
}

function normalizeScoreStatus(score: ExternalPlanScore) {
  const statusLabel = normalizeStatusLabel(score.status_label);

  if (statusLabel === 'available' || statusLabel === 'enable' || statusLabel === 'enabled') {
    return 'available';
  }

  if (statusLabel === 'used') {
    return 'used';
  }

  if (statusLabel === 'disabled' || statusLabel === 'disable') {
    return 'disabled';
  }

  const statusValue = normalizeString(score.status).toLowerCase();

  if (statusValue === '1' || statusValue === 'available' || statusValue === 'enable' || statusValue === 'enabled') {
    return 'available';
  }

  if (statusValue === '2' || statusValue === 'used') {
    return 'used';
  }

  if (statusValue === '3' || statusValue === 'disabled' || statusValue === 'disable') {
    return 'disabled';
  }

  return 'unknown';
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
    label: displayLabelFor(code, label),
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
      const status = normalizeScoreStatus(score);

      if (status === 'available') {
        existing.available += 1;
      } else if (status === 'used') {
        existing.used += 1;
      } else {
        existing.disabled += 1;
      }

      existing.total += 1;

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

  return [...groups.values()];
}
