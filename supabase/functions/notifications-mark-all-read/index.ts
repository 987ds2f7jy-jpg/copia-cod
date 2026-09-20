import { AppError } from '../_shared/errors.ts';
import { createRequestId, ensureMethod, errorResponse, handlePreflight, successResponse } from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { requireNotificationEndUser } from '../_shared/notifications/NotificationAccess.ts';

const FUNCTION_NAME = 'notifications-mark-all-read';
const CORS: CorsOptions = { allowedMethods: ['POST'] };

Deno.serve(async (req) => {
  const preflight = handlePreflight(req, CORS);
  if (preflight) return preflight;
  const requestId = createRequestId();
  const methodError = ensureMethod(req, { allowedMethods: ['POST'], functionName: FUNCTION_NAME, requestId, cors: CORS });
  if (methodError) return methodError;
  try {
    const { client, account } = await requireNotificationEndUser(req);
    const { data, error } = await client.from('user_notifications').update({ read_at: new Date().toISOString() })
      .eq('recipient_user_id', account.id).is('read_at', null).select('id');
    if (error) throw new AppError({ status: 500, code: 'NOTIFICATIONS_MARK_ALL_READ_FAILED', message: 'Unable to update notifications.' });
    return successResponse({ success: true, updatedCount: data?.length || 0 }, requestId, { cors: CORS });
  } catch (error) { return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS }); }
});
