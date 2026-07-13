import { requireAuthenticatedUser } from '../_shared/auth.ts';
import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  readJsonBody,
  successResponse,
} from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { createReconcileFinancialOwnerRuntime } from './repository.ts';
import { reconcileFinancialOwner } from './service.ts';
import { parseReconcileFinancialOwnerInput } from './validation.ts';

const FUNCTION_NAME = 'reconcile-financial-owner';
const CORS: CorsOptions = { allowedMethods: ['POST'] };

export async function handleReconcileFinancialOwnerRequest(req: Request) {
  const preflight = handlePreflight(req, CORS);
  if (preflight) return preflight;
  const requestId = createRequestId();
  const methodError = ensureMethod(req, {
    allowedMethods: ['POST'], functionName: FUNCTION_NAME, requestId, cors: CORS,
  });
  if (methodError) return methodError;

  try {
    const runtime = createReconcileFinancialOwnerRuntime();
    const authenticatedUser = await requireAuthenticatedUser(req, runtime.authUserLookup);
    const admin = await runtime.resolveAdmin(authenticatedUser.authUserId);
    const input = parseReconcileFinancialOwnerInput(await readJsonBody<unknown>(req));
    const result = await reconcileFinancialOwner({
      requestId, input, authenticatedUser, admin, repository: runtime.repository,
    });
    return successResponse(result, requestId, { cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}
