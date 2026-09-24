import { AppError } from '../_shared/errors.ts';
import type { ScheduledNotificationsInput } from './types.ts';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseScheduledNotificationsInput(body: unknown): ScheduledNotificationsInput {
  if (body == null) {
    return { date: null };
  }

  if (typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const rawDate = String((body as Record<string, unknown>).date || '').trim();

  if (!rawDate) {
    return { date: null };
  }

  if (!DATE_PATTERN.test(rawDate)) {
    throw new AppError({
      status: 400,
      code: 'SCHEDULED_NOTIFICATION_DATE_INVALID',
      message: 'date must use YYYY-MM-DD.',
    });
  }

  return { date: rawDate };
}
