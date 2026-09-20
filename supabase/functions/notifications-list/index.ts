import { AppError } from '../_shared/errors.ts';
import { createRequestId, ensureMethod, errorResponse, handlePreflight, readJsonBody, successResponse } from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { requireNotificationEndUser } from '../_shared/notifications/NotificationAccess.ts';

const FUNCTION_NAME = 'notifications-list';
const CORS: CorsOptions = { allowedMethods: ['GET', 'POST'] };

function limitOf(value: unknown) {
  const limit = Number(value);
  return Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 50)) : 20;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req, CORS);
  if (preflight) return preflight;
  const requestId = createRequestId();
  const methodError = ensureMethod(req, { allowedMethods: ['GET', 'POST'], functionName: FUNCTION_NAME, requestId, cors: CORS });
  if (methodError) return methodError;
  try {
    const body = req.method === 'GET'
      ? Object.fromEntries(new URL(req.url).searchParams.entries())
      : await readJsonBody<Record<string, unknown>>(req);
    const { client, account } = await requireNotificationEndUser(req);
    const limit = limitOf(body.limit);
    let query = client.from('user_notifications').select('id, category, title, message, data, related_entity_type, related_entity_id, read_at, created_at, notification_types!inner(key)')
      .eq('recipient_user_id', account.id).order('created_at', { ascending: false }).limit(limit + 1);
    if (body.unread === true || body.unread === 'true') query = query.is('read_at', null);
    if (typeof body.cursor === 'string' && body.cursor.trim()) query = query.lt('created_at', body.cursor.trim());
    const { data, error } = await query;
    if (error) throw new AppError({ status: 500, code: 'NOTIFICATIONS_LIST_FAILED', message: 'Unable to load notifications.' });
    const rows = (data || []) as Array<Record<string, unknown>>;
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => ({
      id: row.id, category: row.category, typeKey: (row.notification_types as { key?: string } | null)?.key || '',
      title: row.title, message: row.message, data: row.data || {}, relatedEntityType: row.related_entity_type,
      relatedEntityId: row.related_entity_id, readAt: row.read_at, createdAt: row.created_at,
    }));
    return successResponse({ items, nextCursor: hasMore ? String(items[items.length - 1]?.createdAt || '') : null }, requestId, { cors: CORS });
  } catch (error) { return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS }); }
});
