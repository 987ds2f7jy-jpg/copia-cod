import type { GetAdminApprovalQueueInput } from './types.ts';

export function parseGetAdminApprovalQueueInput(body: unknown): GetAdminApprovalQueueInput {
  if (!body || typeof body !== 'object') {
    return {};
  }

  const record = body as Record<string, unknown>;
  const status = String(record.status ?? '').trim();
  const limitValue = Number(record.limit ?? 100);
  const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(500, Math.floor(limitValue))) : 100;

  return {
    status: status || undefined,
    limit,
  };
}

