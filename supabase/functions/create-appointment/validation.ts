import { AppError } from '../_shared/errors.ts';
import type { CreateAppointmentInput } from './types.ts';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;

export function parseCreateAppointmentInput(body: unknown): CreateAppointmentInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const professionalProfileIdRaw = String(record.professionalProfileId ?? '').trim();
  const specialty = String(record.specialty ?? '').trim();
  const date = String(record.date ?? '').trim();
  const time = String(record.time ?? '').trim();
  const symptoms = String(record.symptoms ?? '').trim();
  const priority = Boolean(record.priority);
  const professionalProfileId = professionalProfileIdRaw || null;

  if (professionalProfileId && !UUID_REGEX.test(professionalProfileId)) {
    throw new AppError({
      status: 400,
      code: 'PROFESSIONAL_PROFILE_ID_INVALID',
      message: '"professionalProfileId" must be a valid UUID.',
    });
  }

  if (!DATE_REGEX.test(date)) {
    throw new AppError({
      status: 400,
      code: 'DATE_INVALID',
      message: '"date" must be in YYYY-MM-DD format.',
    });
  }

  if (!TIME_REGEX.test(time)) {
    throw new AppError({
      status: 400,
      code: 'TIME_INVALID',
      message: '"time" must be in HH:MM format.',
    });
  }

  if (!professionalProfileId && !specialty) {
    throw new AppError({
      status: 400,
      code: 'SPECIALTY_REQUIRED',
      message: '"specialty" is required when no professional profile is selected.',
    });
  }

  return {
    professionalProfileId,
    specialty,
    date,
    time,
    symptoms,
    priority,
  };
}
