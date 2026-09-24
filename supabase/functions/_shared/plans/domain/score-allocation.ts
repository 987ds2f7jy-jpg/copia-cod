import type { PlanCode } from '../contracts/types.ts';
import { INTERNAL_PLAN_RULES } from './plan-rules.ts';

export type ScoreAllocation = {
  legacySpecializationId: number;
  sequence: number;
};

export function resolveScoreAllocations(
  planCode: PlanCode,
  availableLegacySpecializationIds: Iterable<number>,
): ScoreAllocation[] {
  const available = new Set(availableLegacySpecializationIds);

  return INTERNAL_PLAN_RULES[planCode].scoreAllocations.flatMap((rule) => {
    if (!available.has(rule.legacySpecializationId)) return [];

    return Array.from({ length: rule.quantity }, (_, index) => ({
      legacySpecializationId: rule.legacySpecializationId,
      sequence: index + 1,
    }));
  });
}

