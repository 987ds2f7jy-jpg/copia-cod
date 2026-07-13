import { requireAuthenticatedUser } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { createRequestId, ensureMethod, errorResponse, handlePreflight, readJsonBody, successResponse } from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { insertAuditEvent } from '../_shared/observability.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import { ALLOWED_STATUS_TRANSITIONS, normalizeLimitedText, optionalPrivacyDecisionCode, requirePrivacyRequestStatus, requireRecord, type PrivacyRequestRow } from '../_shared/privacy-rights.ts';
import { createServiceRoleClient, createSupabaseAuthUserLookup } from '../_shared/supabase.ts';

const FUNCTION_NAME = 'review-privacy-rights-request';
const CORS: CorsOptions = { allowedMethods: ['POST'] };

async function handler(req: Request) {
  const preflight = handlePreflight(req, CORS); if (preflight) return preflight;
  const requestId = createRequestId();
  const methodError = ensureMethod(req, { allowedMethods: ['POST'], functionName: FUNCTION_NAME, requestId, cors: CORS });
  if (methodError) return methodError;
  try {
    const client = createServiceRoleClient();
    const authenticated = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
    const admin = await requireAppUserByAuthUserId(client, authenticated.authUserId); requireRole(admin, ['admin']);
    const body = requireRecord(await readJsonBody<unknown>(req));
    const privacyRequestId = String(body.requestId ?? '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(privacyRequestId)) throw new AppError({ status: 422, code: 'PRIVACY_REQUEST_ID_INVALID', message: 'Invalid privacy request identifier.' });
    const nextStatus = requirePrivacyRequestStatus(body.status);
    const expectedVersion = Number(body.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new AppError({ status: 422, code: 'PRIVACY_REVIEW_VERSION_INVALID', message: 'A valid review version is required.' });
    const decisionCode = optionalPrivacyDecisionCode(body.decisionCode);
    const decisionNote = normalizeLimitedText(body.decisionNote, 2000, 'decisionNote') || null;
    const publicResponse = normalizeLimitedText(body.publicResponse, 1000, 'publicResponse') || null;

    const projection = 'id, requester_user_id, request_type, status, description, assigned_admin_user_id, decision_code, decision_note, public_response, review_version, export_storage_path, export_expires_at, submitted_at, completed_at, created_at, updated_at';
    const { data: current, error: loadError } = await client.from('privacy_rights_requests').select(projection).eq('id', privacyRequestId).maybeSingle();
    if (loadError) throw new AppError({ status: 500, code: 'PRIVACY_REVIEW_LOAD_FAILED', message: 'Unable to load privacy request.' });
    if (!current) throw new AppError({ status: 404, code: 'PRIVACY_REQUEST_NOT_FOUND', message: 'Privacy request not found.' });
    const row = current as PrivacyRequestRow;
    if (row.status === nextStatus && row.review_version === expectedVersion) {
      return successResponse({ requestId: row.id, status: row.status, reviewVersion: row.review_version, skipped: true }, requestId, { cors: CORS });
    }
    if (!ALLOWED_STATUS_TRANSITIONS[row.status].includes(nextStatus)) throw new AppError({ status: 409, code: 'PRIVACY_STATUS_TRANSITION_INVALID', message: 'This privacy request status transition is not allowed.' });
    if (nextStatus === 'completed' && !decisionCode) throw new AppError({ status: 422, code: 'PRIVACY_DECISION_REQUIRED', message: 'A decision code is required to complete the request.' });

    const completedAt = ['completed', 'rejected', 'canceled'].includes(nextStatus) ? new Date().toISOString() : null;
    const { data: updated, error } = await client.from('privacy_rights_requests').update({
      status: nextStatus,
      assigned_admin_user_id: admin.id,
      decision_code: decisionCode,
      decision_note: decisionNote,
      public_response: publicResponse,
      completed_at: completedAt,
      review_version: expectedVersion + 1,
    }).eq('id', privacyRequestId).eq('review_version', expectedVersion).eq('status', row.status)
      .select('id, status, decision_code, review_version, completed_at, updated_at').maybeSingle();
    if (error) throw new AppError({ status: 500, code: 'PRIVACY_REVIEW_UPDATE_FAILED', message: 'Unable to review privacy request.' });
    if (!updated) throw new AppError({ status: 409, code: 'PRIVACY_REVIEW_CONFLICT', message: 'The privacy request was reviewed concurrently. Reload and try again.' });
    await insertAuditEvent(client, { actorUserId: admin.id, actorRole: admin.role, action: 'privacy_request.reviewed', resourceType: 'privacy_rights_request', resourceId: privacyRequestId, outcome: 'succeeded', requestId, metadata: { request_type: row.request_type, previous_status: row.status, next_status: nextStatus, decision_code: decisionCode || undefined } });
    return successResponse({ request: { id: updated.id, status: updated.status, decisionCode: updated.decision_code, reviewVersion: updated.review_version, completedAt: updated.completed_at, updatedAt: updated.updated_at }, skipped: false }, requestId, { cors: CORS });
  } catch (error) { return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS }); }
}

export const reviewPrivacyRightsRequestHandler = handler;
Deno.serve(handler);
