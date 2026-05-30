import { AppError } from '../errors.ts';

export type PlanCode = 'weight_loss' | 'psychology' | 'family';

export type PlanCatalogEntry = {
  code: PlanCode;
  label: string;
  amount: number;
  currency: 'BRL';
  externalPlanId: number;
};

export const PLAN_CATALOG: Record<PlanCode, PlanCatalogEntry> = {
  weight_loss: {
    code: 'weight_loss',
    label: 'Emagrecimento',
    amount: 149.9,
    currency: 'BRL',
    externalPlanId: 2,
  },
  family: {
    code: 'family',
    label: 'Familiar',
    amount: 249.9,
    currency: 'BRL',
    externalPlanId: 3,
  },
  psychology: {
    code: 'psychology',
    label: 'Psicologia',
    amount: 199.9,
    currency: 'BRL',
    externalPlanId: 1,
  },
};

export function normalizePlanCode(value: unknown): PlanCode {
  const normalized = String(value || '').trim();

  if (normalized === 'weight_loss' || normalized === 'psychology' || normalized === 'family') {
    return normalized;
  }

  throw new AppError({
    status: 422,
    code: 'PLAN_CODE_INVALID',
    message: 'Plan code is invalid.',
    details: {
      allowedPlanCodes: Object.keys(PLAN_CATALOG),
    },
  });
}

export function resolvePlanCatalogEntry(value: unknown): PlanCatalogEntry {
  return PLAN_CATALOG[normalizePlanCode(value)];
}
