import { requireAuthenticatedUser } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  readJsonBody,
  successResponse,
} from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { insertAuditEvent, logTechnicalEvent } from '../_shared/observability.ts';
import { requireAppUserByAuthUserId } from '../_shared/professional.ts';
import {
  createRequestFingerprint,
  mapSelfServicePrivacyRequest,
  normalizeLimitedText,
  OPEN_PRIVACY_STATUSES,
  requireIdempotencyKey,
  requirePrivacyRequestType,
  requireRecord,
  type PrivacyRequestRow,
} from '../_shared/privacy-rights.ts';
import { createServiceRoleClient, createSupabaseAuthUserLookup } from '../_shared/supabase.ts';

const FUNCTION_NAME = 'create-privacy-rights-request';
const CORS: CorsOptions = { allowedMethods: ['POST'] };

async function handler(req: Request) {
  const preflight = handlePreflight(req, CORS);
  if (preflight) return preflight;
  const requestId = createRequestId();
  const methodError = ensureMethod(req, {
    allowedMethods: ['POST'], functionName: FUNCTION_NAME, requestId, cors: CORS,
  });
  if (methodError) return methodError;

  try {
    const client = createServiceRoleClient();
    const authenticated = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
    const user = await requireAppUserByAuthUserId(client, authenticated.authUserId);
    const body = requireRecord(await readJsonBody<unknown>(req));
    const requestType = requirePrivacyRequestType(body.requestType);
    const description = normalizeLimitedText(body.description, 2000, 'description');
    const idempotencyKey = requireIdempotencyKey(body.idempotencyKey);
    const fingerprint = await createRequestFingerprint(requestType, description);
    const projection = 'id, requester_user_id, request_type, status, description, assigned_admin_user_id, decision_code, decision_note, public_response, review_version, export_storage_path, export_expires_at, submitted_at, completed_at, created_at, updated_at';

    const { data: existingByKey } = await client
      .from('privacy_rights_requests')
      .select(projection)
      .eq('requester_user_id', user.id)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existingByKey) return successResponse({ request: mapSelfServicePrivacyRequest(existingByKey as PrivacyRequestRow), created: false }, requestId, { cors: CORS });

    const { data: existingOpen } = await client
      .from('privacy_rights_requests')
      .select(projection)
      .eq('requester_user_id', user.id)
      .eq('request_type', requestType)
      .eq('request_fingerprint', fingerprint)
      .in('status', OPEN_PRIVACY_STATUSES)
      .maybeSingle();
    if (existingOpen) return successResponse({ request: mapSelfServicePrivacyRequest(existingOpen as PrivacyRequestRow), created: false }, requestId, { cors: CORS });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: rateError } = await client
      .from('privacy_rights_requests')
      .select('id', { count: 'exact', head: true })
      .eq('requester_user_id', user.id)
      .gte('submitted_at', oneHourAgo);
    if (rateError) throw new AppError({ status: 500, code: 'PRIVACY_RATE_LOOKUP_FAILED', message: 'Unable to validate request rate.' });
    if ((count || 0) >= 5) throw new AppError({ status: 429, code: 'PRIVACY_REQUEST_RATE_LIMITED', message: 'Too many privacy requests. Try again later.' });

    const { data, error } = await client.from('privacy_rights_requests').insert({
      requester_user_id: user.id,
      request_type: requestType,
      description,
      request_fingerprint: fingerprint,
      idempotency_key: idempotencyKey,
    }).select(projection).single();
    if (error) {
      if (error.code === '23505') {
        const { data: raced } = await client.from('privacy_rights_requests').select(projection)
          .eq('requester_user_id', user.id).eq('request_type', requestType)
          .eq('request_fingerprint', fingerprint).in('status', OPEN_PRIVACY_STATUSES).maybeSingle();
        if (raced) return successResponse({ request: mapSelfServicePrivacyRequest(raced as PrivacyRequestRow), created: false }, requestId, { cors: CORS });
      }
      throw new AppError({ status: 500, code: 'PRIVACY_REQUEST_CREATE_FAILED', message: 'Unable to create privacy request.' });
    }

    await insertAuditEvent(client, {
      actorUserId: user.id, actorRole: user.role, action: 'privacy_request.submitted',
      resourceType: 'privacy_rights_request', resourceId: data.id, outcome: 'succeeded', requestId,
      metadata: { request_type: requestType, request_status: 'submitted' },
    });
    logTechnicalEvent('info', { functionName: FUNCTION_NAME, requestId, operation: 'privacy_request.submit', actorId: user.id, actorRole: user.role, resourceType: 'privacy_rights_request', resourceId: data.id, status: 'succeeded' });
    return successResponse({ request: mapSelfServicePrivacyRequest(data as PrivacyRequestRow), created: true }, requestId, { status: 201, cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}

export const createPrivacyRightsRequestHandler = handler;
Deno.serve(handler);
