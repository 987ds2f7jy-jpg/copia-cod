import { describe, expect, it } from 'vitest';
import { aggregateExternalScoresForCredits } from '../../supabase/functions/_shared/plans/plan-scores.ts';

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
});
