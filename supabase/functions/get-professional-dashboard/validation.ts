import type { GetProfessionalDashboardInput } from './types.ts';

export function parseGetProfessionalDashboardInput(body: unknown): GetProfessionalDashboardInput {
  if (!body || typeof body !== 'object') {
    return {};
  }

  const record = body as Record<string, unknown>;
  const appointmentsLimitValue = Number(record.appointmentsLimit ?? 200);
  const appointmentsLimit = Number.isFinite(appointmentsLimitValue)
    ? Math.max(1, Math.min(500, Math.floor(appointmentsLimitValue)))
    : 200;

  return {
    appointmentsLimit,
    includeQueue: record.includeQueue === undefined ? true : Boolean(record.includeQueue),
    includeQuestions: record.includeQuestions === undefined ? true : Boolean(record.includeQuestions),
    includeReviews: record.includeReviews === undefined ? true : Boolean(record.includeReviews),
  };
}

