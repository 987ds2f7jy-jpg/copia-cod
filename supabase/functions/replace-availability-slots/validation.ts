import { AppError } from '../_shared/errors.ts';
import type { ReplaceAvailabilitySlotsInput } from './types.ts';

export function parseReplaceAvailabilitySlotsInput(body: unknown): ReplaceAvailabilitySlotsInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const slotsValue = record.slots;

  if (!Array.isArray(slotsValue)) {
    throw new AppError({
      status: 400,
      code: 'SLOTS_REQUIRED',
      message: '"slots" must be an array.',
    });
  }

  const slots = slotsValue.map((slot, idx) => {
    if (!slot || typeof slot !== 'object') {
      throw new AppError({
        status: 422,
        code: 'SLOT_INVALID',
        message: 'Each slot must be an object.',
        details: { index: idx },
      });
    }

    const s = slot as Record<string, unknown>;
    const weekday = Number(s.weekday);
    const timeSlot = String(s.timeSlot ?? '').trim();

    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      throw new AppError({
        status: 422,
        code: 'WEEKDAY_INVALID',
        message: '"weekday" must be between 0 and 6.',
        details: { index: idx, weekday },
      });
    }

    if (!timeSlot) {
      throw new AppError({
        status: 422,
        code: 'TIME_SLOT_REQUIRED',
        message: '"timeSlot" is required.',
        details: { index: idx },
      });
    }

    return { weekday, timeSlot };
  });

  return { slots };
}

