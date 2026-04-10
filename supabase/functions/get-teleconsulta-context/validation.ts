import { AppError } from '../_shared/errors.ts';
import type { GetTeleconsultaContextInput } from './types.ts';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeOptionalUuid(value: unknown) {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    return null;
  }

  if (!UUID_REGEX.test(normalized)) {
    throw new AppError({
      status: 400,
      code: 'UUID_INVALID',
      message: 'One of the provided identifiers is invalid.',
    });
  }

  return normalized;
}

export function parseGetTeleconsultaContextInput(body: unknown): GetTeleconsultaContextInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const consultationId = normalizeOptionalUuid(record.consultationId);
  const patientId = normalizeOptionalUuid(record.patientId);
  const excludeConsultationId = normalizeOptionalUuid(record.excludeConsultationId);
  const patientIds = Array.isArray(record.patientIds)
    ? [...new Set(record.patientIds.map((value) => normalizeOptionalUuid(value)).filter(Boolean) as string[])]
    : [];
  const historyLimitRaw = Number(record.historyLimit ?? 20);
  const historyLimit = Number.isInteger(historyLimitRaw) ? historyLimitRaw : 20;

  if (historyLimit < 1 || historyLimit > 50) {
    throw new AppError({
      status: 422,
      code: 'HISTORY_LIMIT_INVALID',
      message: '"historyLimit" must be an integer between 1 and 50.',
    });
  }

  const activeSelectors = [Boolean(consultationId), Boolean(patientId), patientIds.length > 0].filter(Boolean).length;

  if (activeSelectors !== 1) {
    throw new AppError({
      status: 400,
      code: 'CONTEXT_SELECTOR_INVALID',
      message: 'Provide exactly one of "consultationId", "patientId" or "patientIds".',
    });
  }

  if (patientIds.length > 25) {
    throw new AppError({
      status: 422,
      code: 'PATIENT_IDS_LIMIT_EXCEEDED',
      message: '"patientIds" supports at most 25 items per request.',
    });
  }

  return {
    consultationId,
    patientId,
    patientIds,
    historyLimit,
    excludeConsultationId,
  };
}
