import { AppError } from '../_shared/errors.ts';
import type { ReconciliationQueueInput } from './types.ts';

function optionalString(value: unknown, maxLength = 120) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function positiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function optionalIsoDate(value: unknown, field: string) {
  const normalized = optionalString(value, 40);
  if (!normalized) return undefined;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError({
      status: 422,
      code: 'RECONCILIATION_DATE_INVALID',
      message: `${field} must be a valid ISO-8601 date.`,
    });
  }

  return parsed.toISOString();
}

export function parseReconciliationQueueInput(body: unknown): ReconciliationQueueInput {
  const record = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};

  return {
    type: optionalString(record.type),
    status: optionalString(record.status, 40),
    from: optionalIsoDate(record.from, 'from'),
    to: optionalIsoDate(record.to, 'to'),
    page: positiveInteger(record.page, 1, 10_000),
    pageSize: positiveInteger(record.pageSize, 25, 100),
  };
}
