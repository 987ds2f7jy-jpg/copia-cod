import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aggregateExternalScoresForCredits } from '../../supabase/functions/_shared/plans/plan-scores.ts';

const getMyPlansSource = readFileSync('supabase/functions/get-my-plans/index.ts', 'utf8');

describe('my plans score normalization', () => {
  it('groups external scores by specialty and aggregates available, used, and disabled statuses', () => {
    const credits = aggregateExternalScoresForCredits([
      {
        id: 7,
        plan_id: 3,
        plan_name: 'Plano familiar',
        status_label: 'active',
        scores: [
          {
            subscription_score_id: 156,
            score_id: 10,
            status_label: 'available',
            specialization_id: 22,
            specialization_name: 'Psicologia',
          },
          {
            subscription_score_id: 157,
            score_id: 10,
            status_label: 'available',
            specialization_id: 22,
            specialization_name: 'Psicologia',
          },
          {
            subscription_score_id: 158,
            score_id: 10,
            status_label: 'used',
            specialization_id: 22,
            specialization_name: 'Psicologia',
          },
          {
            subscription_score_id: 159,
            score_id: 10,
            status_label: 'disabled',
            specialization_id: 22,
            specialization_name: 'Psicologia',
          },
        ],
      },
    ]);

    expect(credits).toEqual([
      expect.objectContaining({
        id: 'psicologia',
        code: 'psicologia',
        label: 'Psicologia',
        included: true,
        available: 2,
        used: 1,
        disabled: 1,
        total: 4,
        source: 'plans_service',
        specializationId: 22,
        scoreIds: [10],
        subscriptionScoreIds: [156, 157, 158, 159],
      }),
    ]);
  });

  it('shows every real score returned for the weight loss plan and does not add endocrinology by catalog', () => {
    const credits = aggregateExternalScoresForCredits([
      {
        id: 8,
        plan_id: 2,
        plan_name: 'Plano de emagrecimento',
        status_label: 'active',
        scores: [
          {
            subscription_score_id: 201,
            score_id: 11,
            status_label: 'available',
            specialization_id: 2,
            specialization_name: 'Clinica Medica',
          },
          {
            subscription_score_id: 202,
            score_id: 12,
            status_label: 'available',
            specialization_id: 23,
            specialization_name: 'Nutricao',
          },
          {
            subscription_score_id: 203,
            score_id: 13,
            status_label: 'available',
            specialization_id: 24,
            specialization_name: 'Educacao Fisica',
          },
        ],
      },
    ]);

    expect(credits.map((credit) => credit.label)).toEqual([
      'Clínica Médica',
      'Nutrição',
      'Educação Física',
    ]);
    expect(credits).toHaveLength(3);
    expect(credits.some((credit) => credit.code.includes('endocrinologia'))).toBe(false);
  });

  it('keeps unknown specialties visible instead of discarding them', () => {
    const credits = aggregateExternalScoresForCredits([
      {
        id: 9,
        plan_id: 2,
        plan_name: 'Plano de emagrecimento',
        status_label: 'active',
        scores: [
          {
            subscription_score_id: 204,
            score_id: 14,
            status_label: 'available',
            specialization_id: 7,
            specialization_name: 'Endocrinologia e Metabologia',
          },
          {
            subscription_score_id: 205,
            score_id: 15,
            status_label: 'unexpected-status',
            specialization_id: 99,
            specialization_name: 'Especialidade Nova',
          },
        ],
      },
    ]);

    expect(credits).toEqual([
      expect.objectContaining({
        code: 'endocrinologia_e_metabologia',
        label: 'Endocrinologia e Metabologia',
        available: 1,
        total: 1,
      }),
      expect.objectContaining({
        code: 'especialidade_nova',
        label: 'Especialidade Nova',
        available: 0,
        disabled: 1,
        total: 1,
      }),
    ]);
  });

  it('normalizes legacy numeric and enum-like status values without hiding scores', () => {
    const credits = aggregateExternalScoresForCredits([
      {
        id: 10,
        plan_id: 3,
        plan_name: 'Plano familiar',
        status_label: 'active',
        scores: [
          {
            subscription_score_id: 301,
            score_id: 21,
            status: 1,
            status_label: 'enable',
            specialization_id: 2,
            specialization_name: 'Clinica Medica',
          },
          {
            subscription_score_id: 302,
            score_id: 21,
            status: 2,
            specialization_id: 2,
            specialization_name: 'Clinica Medica',
          },
          {
            subscription_score_id: 303,
            score_id: 21,
            status: 3,
            specialization_id: 2,
            specialization_name: 'Clinica Medica',
          },
        ],
      },
    ]);

    expect(credits).toEqual([
      expect.objectContaining({
        label: 'Clínica Médica',
        available: 1,
        used: 1,
        disabled: 1,
        total: 3,
      }),
    ]);
  });
});

describe('my plans coverage contract', () => {
  it('derives included coverage from real credits when plans-service is the source', () => {
    expect(getMyPlansSource).toContain("creditResolution?.source === 'plans_service'");
    expect(getMyPlansSource).toContain('coverage: buildCoverage(planCode, creditResolution)');
    expect(getMyPlansSource).toContain('.map((credit) => credit.label)');
  });

  it('keeps the weight loss catalog fallback aligned with the plans-service contract', () => {
    expect(getMyPlansSource).toContain("{ code: 'clinica_medica', label: 'Clinica Medica', included: true }");
    expect(getMyPlansSource).not.toContain("{ code: 'endocrinologia', label: 'Endocrinologia', included: true }");
  });
});
