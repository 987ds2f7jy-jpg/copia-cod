import { AppError } from '../_shared/errors.ts';

export function parseBackofficeServicesListInput(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({ status: 400, code: 'INVALID_BODY', message: 'Request body must be an object.' });
  }

  if (Object.keys(body as Record<string, unknown>).length > 0) {
    throw new AppError({
      status: 400,
      code: 'BACKOFFICE_SERVICES_LIST_FIELDS_INVALID',
      message: 'Service list does not accept request fields.',
    });
  }

  return {};
}
