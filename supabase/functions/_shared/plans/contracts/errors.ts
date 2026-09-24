import { AppError } from '../../errors.ts';

const DOMAIN_ERROR_STATUS: Record<string, number> = {
  PLAN_ORDER_NOT_FOUND: 404,
  PLAN_SUBSCRIPTION_NOT_FOUND: 404,
  PLAN_SUBSCRIPTION_SCORE_NOT_FOUND: 404,
  PLAN_PAYMENT_CHARGE_NOT_PAID: 409,
  PLAN_NOT_ACTIVE: 422,
  PLAN_ACTIVATION_IDEMPOTENCY_CONFLICT: 409,
  PLAN_SUBSCRIPTION_SCORE_NOT_AVAILABLE: 409,
  PLAN_FAMILY_HOLDER_REQUIRED: 403,
  PLAN_FAMILY_SUBSCRIPTION_NOT_ACTIVE: 409,
  PLAN_FAMILY_SUBSCRIPTION_REQUIRED: 422,
  PLAN_FAMILY_HOLDER_ALREADY_INCLUDED: 422,
  PLAN_FAMILY_MEMBER_DUPLICATE: 409,
  PLAN_FAMILY_LIMIT_REACHED: 409,
  PLAN_CREDIT_USAGE_LINK_INVALID: 409,
};

export function internalPlansError(operation: string, error: unknown) {
  const message = error instanceof Error
    ? error.message
    : String((error as { message?: unknown } | null)?.message || 'Internal Plans operation failed.');
  const domainCode = Object.keys(DOMAIN_ERROR_STATUS).find((code) => message.includes(code));

  return new AppError({
    status: domainCode ? DOMAIN_ERROR_STATUS[domainCode] : 500,
    code: domainCode || 'INTERNAL_PLANS_OPERATION_FAILED',
    message: domainCode || `Internal Plans ${operation} failed.`,
    details: { operation },
  });
}

