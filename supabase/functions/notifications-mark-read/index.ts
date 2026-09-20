import { AppError } from '../_shared/errors.ts';
import { createRequestId, ensureMethod, errorResponse, handlePreflight, readJsonBody, successResponse } from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { requireNotificationEndUser } from '../_shared/notifications/NotificationAccess.ts';

const FUNCTION_NAME = 'notifications-mark-read';
const CORS: CorsOptions = { allowedMethods: ['POST'] };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const preflight = handlePreflight(req, CORS);
  if (preflight) return preflight;
  const requestId = createRequestId();
  const methodError = ensureMethod(req, { allowedMethods: ['POST'], functionName: FUNCTION_NAME, requestId, cors: CORS });
  if (methodError) return methodError;
  try {
    const body = await readJsonBody<Record<string, unknown>>(req);
    const notificationId = String(body.notificationId || '').trim();
    if (!UUID.test(notificationId)) throw new AppError({ status: 422, code: 'NOTIFICATION_ID_INVALID', message: 'notificationId must be a UUID.' });
    const { client, account } = await requireNotificationEndUser(req);
    const { data: ownedNotification, error: lookupError } = await client.from('user_notifications').select('id, read_at')
      .eq('id', notificationId).eq('recipient_user_id', account.id).maybeSingle();
    if (lookupError) throw new AppError({ status: 500, code: 'NOTIFICATION_MARK_READ_FAILED', message: 'Unable to update notification.' });
    if (!ownedNotification) throw new AppError({ status: 404, code: 'NOTIFICATION_NOT_FOUND', message: 'Notification was not found.' });
    if (ownedNotification.read_at) return successResponse({ success: true }, requestId, { cors: CORS });
    const { data, error } = await client.from('user_notifications').update({ read_at: new Date().toISOString() })
      .eq('id', notificationId).eq('recipient_user_id', account.id).is('read_at', null).select('id');
    if (error) throw new AppError({ status: 500, code: 'NOTIFICATION_MARK_READ_FAILED', message: 'Unable to update notification.' });
    // Deliberately do not reveal whether the ID exists or belongs to another user.
    if (!data?.length) throw new AppError({ status: 404, code: 'NOTIFICATION_NOT_FOUND', message: 'Notification was not found.' });
    return successResponse({ success: true }, requestId, { cors: CORS });
  } catch (error) { return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS }); }
});
