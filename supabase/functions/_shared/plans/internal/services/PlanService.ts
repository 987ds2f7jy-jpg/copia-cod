import type { PlanCode } from '../../contracts/types.ts';
import { INTERNAL_PLAN_RULES } from '../../domain/plan-rules.ts';

export class PlanService {
  getRule(planCode: PlanCode) {
    return INTERNAL_PLAN_RULES[planCode];
  }
}

