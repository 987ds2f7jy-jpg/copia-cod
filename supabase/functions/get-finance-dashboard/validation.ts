import type { GetFinanceDashboardInput } from './types.ts';

export function parseGetFinanceDashboardInput(body: unknown): GetFinanceDashboardInput {
  if (!body || typeof body !== 'object') {
    return {};
  }

  const record = body as Record<string, unknown>;
  const appointmentsLimitValue = Number(record.appointmentsLimit ?? 500);
  const saquesLimitValue = Number(record.saquesLimit ?? 50);

  const appointmentsLimit = Number.isFinite(appointmentsLimitValue)
    ? Math.max(1, Math.min(1000, Math.floor(appointmentsLimitValue)))
    : 500;
  const saquesLimit = Number.isFinite(saquesLimitValue)
    ? Math.max(1, Math.min(200, Math.floor(saquesLimitValue)))
    : 50;

  return { appointmentsLimit, saquesLimit };
}

