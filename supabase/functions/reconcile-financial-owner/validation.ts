import { AppError } from '../_shared/errors.ts';
import type {
  ReconciliationOwnerType,
  ReconcileFinancialOwnerInput,
} from './types.ts';

const OWNER_TYPES = new Set<ReconciliationOwnerType>([
  'appointment',
  'queue',
  'solicitacao_exame',
  'plan_subscription',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseReconcileFinancialOwnerInput(body: unknown): ReconcileFinancialOwnerInput {
  const record = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const ownerType = String(record.ownerType ?? '').trim() as ReconciliationOwnerType;
  const ownerId = String(record.ownerId ?? '').trim();

  if (!OWNER_TYPES.has(ownerType)) {
    throw new AppError({
      status: 422,
      code: 'RECONCILIATION_OWNER_TYPE_INVALID',
      message: 'ownerType is not supported for reconciliation.',
    });
  }

  if (!UUID_PATTERN.test(ownerId)) {
    throw new AppError({
      status: 422,
      code: 'RECONCILIATION_OWNER_ID_INVALID',
      message: 'ownerId must be a valid UUID.',
    });
  }

  return { ownerType, ownerId };
}
