import { requireAuthenticatedUser } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { createRequestId, ensureMethod, errorResponse, handlePreflight, readJsonBody, successResponse } from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { requireAppUserByAuthUserId } from '../_shared/professional.ts';
import { mapSelfServicePrivacyRequest, requireRecord, type PrivacyRequestRow } from '../_shared/privacy-rights.ts';
import { createServiceRoleClient, createSupabaseAuthUserLookup } from '../_shared/supabase.ts';

const FUNCTION_NAME = 'get-my-privacy-rights-requests';
const CORS: CorsOptions = { allowedMethods: ['POST'] };

async function handler(req: Request) {
  const preflight = handlePreflight(req, CORS); if (preflight) return preflight;
  const requestId = createRequestId();
  const methodError = ensureMethod(req, { allowedMethods: ['POST'], functionName: FUNCTION_NAME, requestId, cors: CORS });
  if (methodError) return methodError;
  try {
    const client = createServiceRoleClient();
    const authenticated = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
    const user = await requireAppUserByAuthUserId(client, authenticated.authUserId);
    const rawBody = await readJsonBody<unknown>(req);
    const body = rawBody == null ? {} : requireRecord(rawBody);
    const page = Math.max(1, Math.min(10_000, Math.trunc(Number(body.page) || 1)));
    const pageSize = Math.max(1, Math.min(50, Math.trunc(Number(body.pageSize) || 20)));
    const from = (page - 1) * pageSize;
    const projection = 'id, requester_user_id, request_type, status, description, assigned_admin_user_id, decision_code, decision_note, public_response, review_version, export_storage_path, export_expires_at, submitted_at, completed_at, created_at, updated_at';
    const { data, error, count } = await client.from('privacy_rights_requests')
      .select(projection, { count: 'exact' }).eq('requester_user_id', user.id)
      .order('submitted_at', { ascending: false }).range(from, from + pageSize - 1);
    if (error) throw new AppError({ status: 500, code: 'PRIVACY_REQUEST_LIST_FAILED', message: 'Unable to list privacy requests.' });
    return successResponse({
      items: ((data as PrivacyRequestRow[] | null) || []).map(mapSelfServicePrivacyRequest),
      pagination: { page, pageSize, total: count || 0, totalPages: Math.ceil((count || 0) / pageSize) },
    }, requestId, { cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}

export const getMyPrivacyRightsRequestsHandler = handler;
Deno.serve(handler);
