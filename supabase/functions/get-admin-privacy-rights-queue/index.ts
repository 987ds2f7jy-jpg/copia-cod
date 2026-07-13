import { requireAuthenticatedUser } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { createRequestId, ensureMethod, errorResponse, handlePreflight, readJsonBody, successResponse } from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { insertAuditEvent } from '../_shared/observability.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import { PRIVACY_REQUEST_STATUSES, PRIVACY_REQUEST_TYPES, requireRecord } from '../_shared/privacy-rights.ts';
import { createServiceRoleClient, createSupabaseAuthUserLookup } from '../_shared/supabase.ts';

const FUNCTION_NAME = 'get-admin-privacy-rights-queue';
const CORS: CorsOptions = { allowedMethods: ['POST'] };

function optionalDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new AppError({ status: 422, code: 'PRIVACY_DATE_INVALID', message: 'Invalid date filter.' });
  return date.toISOString();
}

async function handler(req: Request) {
  const preflight = handlePreflight(req, CORS); if (preflight) return preflight;
  const requestId = createRequestId();
  const methodError = ensureMethod(req, { allowedMethods: ['POST'], functionName: FUNCTION_NAME, requestId, cors: CORS });
  if (methodError) return methodError;
  try {
    const client = createServiceRoleClient();
    const authenticated = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
    const admin = await requireAppUserByAuthUserId(client, authenticated.authUserId); requireRole(admin, ['admin']);
    const rawBody = await readJsonBody<unknown>(req); const body = rawBody == null ? {} : requireRecord(rawBody);
    const type = String(body.type ?? '').trim(); const status = String(body.status ?? '').trim();
    if (type && !PRIVACY_REQUEST_TYPES.some((allowed) => allowed === type)) throw new AppError({ status: 422, code: 'PRIVACY_REQUEST_TYPE_INVALID', message: 'Invalid type filter.' });
    if (status && !PRIVACY_REQUEST_STATUSES.some((allowed) => allowed === status)) throw new AppError({ status: 422, code: 'PRIVACY_REQUEST_STATUS_INVALID', message: 'Invalid status filter.' });
    const page = Math.max(1, Math.min(10_000, Math.trunc(Number(body.page) || 1)));
    const pageSize = Math.max(1, Math.min(100, Math.trunc(Number(body.pageSize) || 25)));
    const from = (page - 1) * pageSize; const dateFrom = optionalDate(body.from); const dateTo = optionalDate(body.to);
    let query = client.from('privacy_rights_requests').select('id, requester_user_id, request_type, status, assigned_admin_user_id, decision_code, review_version, submitted_at, completed_at, updated_at', { count: 'exact' });
    if (type) query = query.eq('request_type', type); if (status) query = query.eq('status', status);
    if (dateFrom) query = query.gte('submitted_at', dateFrom); if (dateTo) query = query.lte('submitted_at', dateTo);
    const { data, error, count } = await query.order('submitted_at', { ascending: true }).range(from, from + pageSize - 1);
    if (error) throw new AppError({ status: 500, code: 'PRIVACY_ADMIN_QUEUE_FAILED', message: 'Unable to list privacy requests.' });
    await insertAuditEvent(client, { actorUserId: admin.id, actorRole: admin.role, action: 'privacy_request.admin_queue_accessed', resourceType: 'privacy_rights_queue', outcome: 'succeeded', requestId });
    return successResponse({ items: data || [], pagination: { page, pageSize, total: count || 0, totalPages: Math.ceil((count || 0) / pageSize) } }, requestId, { cors: CORS });
  } catch (error) { return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS }); }
}

export const getAdminPrivacyRightsQueueHandler = handler;
Deno.serve(handler);
