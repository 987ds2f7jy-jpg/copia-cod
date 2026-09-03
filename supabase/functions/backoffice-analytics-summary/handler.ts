import { createRequestId, ensureMethod, errorResponse, handlePreflight, readJsonBody, successResponse } from '../_shared/http.ts';
import { createBackofficeAnalyticsRuntime } from './repository.ts';
import { getBackofficeAnalyticsSummary } from './service.ts';

const FUNCTION_NAME = 'backoffice-analytics-summary';
const CORS = { allowedMethods: ['POST'] };

export async function handleBackofficeAnalyticsSummaryRequest(req: Request) {
  const preflight = handlePreflight(req, CORS);
  if (preflight) return preflight;
  const requestId = createRequestId();
  const methodError = ensureMethod(req, { allowedMethods: ['POST'], functionName: FUNCTION_NAME, requestId, cors: CORS });
  if (methodError) return methodError;
  try {
    await readJsonBody(req);
    const runtime = createBackofficeAnalyticsRuntime();
    const result = await getBackofficeAnalyticsSummary({ req, client: runtime.client, repository: runtime.repository });
    return successResponse(result, requestId, { cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}
