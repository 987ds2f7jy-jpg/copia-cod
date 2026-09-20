import { AppError } from '../_shared/errors.ts';
import { createRequestId, ensureMethod, errorResponse, handlePreflight, successResponse } from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { requireNotificationEndUser } from '../_shared/notifications/NotificationAccess.ts';

const FUNCTION_NAME = 'notifications-unread-count';
const CORS: CorsOptions = { allowedMethods: ['GET', 'POST'] };

Deno.serve(async (req) => {
  const preflight = handlePreflight(req, CORS);
  if (preflight) return preflight;
  const requestId = createRequestId();
  const methodError = ensureMethod(req, { allowedMethods: ['GET', 'POST'], functionName: FUNCTION_NAME, requestId, cors: CORS });
  if (methodError) return methodError;
  try {
    const { client, account } = await requireNotificationEndUser(req);
    const { count, error } = await client.from('user_notifications').select('*', { count: 'exact', head: true })
      .eq('recipient_user_id', account.id).is('read_at', null);
    if (error) throw new AppError({ status: 500, code: 'NOTIFICATIONS_UNREAD_COUNT_FAILED', message: 'Unable to load notifications.' });
    return successResponse({ unreadCount: count || 0 }, requestId, { cors: CORS });
  } catch (error) { return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS }); }
});
