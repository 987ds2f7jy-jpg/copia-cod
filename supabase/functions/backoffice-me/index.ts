import { requireActiveBackofficeAdmin } from '../_shared/backofficeAuth.ts';
import { BACKOFFICE_CORS, handleBackofficePreflight } from '../_shared/backofficeCors.ts';
import { createRequestId, ensureMethod, errorResponse, successResponse } from '../_shared/http.ts';
import { createServiceRoleClient } from '../_shared/supabase.ts';

const FUNCTION_NAME = 'backoffice-me';
const CORS = BACKOFFICE_CORS;

Deno.serve(async (req) => {
  const preflight = handleBackofficePreflight(req);
  if (preflight) return preflight;
  const requestId = createRequestId();
  const methodError = ensureMethod(req, { allowedMethods: ['POST'], functionName: FUNCTION_NAME, requestId, cors: CORS });
  if (methodError) return methodError;
  try {
    const admin = await requireActiveBackofficeAdmin(req, createServiceRoleClient());
    return successResponse({ admin }, requestId, { cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
});
