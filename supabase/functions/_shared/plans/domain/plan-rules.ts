import type { PlanCode } from '../contracts/types.ts';

export type PlanRule = {
  code: PlanCode;
  legacyPlanId: number;
  literalName: string;
  scoreAllocations: ReadonlyArray<{ legacySpecializationId: number; quantity: number }>;
  synchronizedExternalAccess: readonly string[];
  familySizeLimit: number | null;
};

export const INTERNAL_PLAN_RULES: Record<PlanCode, PlanRule> = {
  psychology: {
    code: 'psychology', legacyPlanId: 1, literalName: 'Plano de psicologia',
    scoreAllocations: [{ legacySpecializationId: 22, quantity: 4 }],
    synchronizedExternalAccess: [], familySizeLimit: null,
  },
  weight_loss: {
    code: 'weight_loss', legacyPlanId: 2, literalName: 'Plano de emagrecimento',
    scoreAllocations: [
      { legacySpecializationId: 2, quantity: 1 },
      { legacySpecializationId: 23, quantity: 1 },
      { legacySpecializationId: 24, quantity: 1 },
    ],
    synchronizedExternalAccess: ['app_nutricao'], familySizeLimit: null,
  },
  family: {
    code: 'family', legacyPlanId: 3, literalName: 'Plano familiar',
    scoreAllocations: [{ legacySpecializationId: 2, quantity: 1 }],
    synchronizedExternalAccess: [], familySizeLimit: 4,
  },
};

