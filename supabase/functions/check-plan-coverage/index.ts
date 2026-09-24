import { requireAuthenticatedUser } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { createRequestId, ensureMethod, errorResponse, handlePreflight, readJsonBody, successResponse } from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { resolvePlanCoverage, SPECIALTY_PLAN_LOOKUPS } from '../_shared/plans/coverage.ts';
import { normalizePricingSpecialty } from '../_shared/pricing/service-codes.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import { createServiceRoleClient, createSupabaseAuthUserLookup } from '../_shared/supabase.ts';

const FUNCTION_NAME = 'check-plan-coverage';
const CORS: CorsOptions = { allowedMethods: ['POST'] };

type CoverageReason = 'plan_credit_available' | 'no_plan_credit_available' | 'plans_service_unavailable' | 'specialty_not_mapped' | 'flow_not_plan_eligible';
type RequestBody = { flow?: string; specialty_code?: string; specialtyCode?: string; specialty?: string; plan_id?: number | string; planId?: number | string };

function text(value: unknown) { return String(value ?? '').trim(); }
function integer(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
function supportedFlow(flow: string) { return ['specialty', 'appointment_specialty', 'duty', 'on_duty'].includes(flow); }
function base(reason: CoverageReason, specialtyCode: string, specializationId: number | null, planId: number | null) {
  const messages: Record<CoverageReason, string> = {
    plan_credit_available: 'Plano disponivel para esta consulta.',
    no_plan_credit_available: 'Nenhum credito de plano disponivel para esta consulta.',
    plans_service_unavailable: 'Nao foi possivel verificar o plano agora. Fluxo avulso permanece disponivel.',
    specialty_not_mapped: 'Esta especialidade ainda nao esta vinculada a planos.',
    flow_not_plan_eligible: 'Este fluxo nao e elegivel para planos.',
  };
  const covered = reason === 'plan_credit_available';
  return { covered, funding_source: covered ? 'plan' : 'self_pay', reason, specialty_code: specialtyCode, external_specialization_id: specializationId, external_plan_id: planId, message: messages[reason] };
}

export async function handleCheckPlanCoverageRequest(req: Request) {
  const preflight = handlePreflight(req, CORS);
  if (preflight) return preflight;
  const requestId = createRequestId();
  const methodError = ensureMethod(req, { allowedMethods: ['POST'], functionName: FUNCTION_NAME, requestId, cors: CORS });
  if (methodError) return methodError;

  try {
    const body = await readJsonBody<unknown>(req);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError({ status: 400, code: 'INVALID_BODY', message: 'Request body must be an object.' });
    const input = body as RequestBody;
    const flow = text(input.flow).toLowerCase();
    const specialtyCode = normalizePricingSpecialty(text(input.specialty_code || input.specialtyCode || input.specialty));
    const requestedPlanId = integer(input.plan_id || input.planId);
    const lookup = SPECIALTY_PLAN_LOOKUPS[specialtyCode] || null;

    if (!supportedFlow(flow)) return successResponse(base('flow_not_plan_eligible', specialtyCode, null, requestedPlanId), requestId, { status: 200, cors: CORS });
    if (!lookup) return successResponse(base('specialty_not_mapped', specialtyCode, null, requestedPlanId), requestId, { status: 200, cors: CORS });

    const client = createServiceRoleClient();
    const authenticated = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
    const appUser = await requireAppUserByAuthUserId(client, authenticated.authUserId);
    requireRole(appUser, ['patient']);

    try {
      const coverage = await resolvePlanCoverage({
        client, appUserId: appUser.id, fallbackExternalKey: text(appUser.email || authenticated.email),
        specialtyCode, flow: flow === 'duty' || flow === 'on_duty' ? 'on_duty' : 'appointment_specialty',
        legacyPlanId: requestedPlanId,
      });
      if (!coverage) {
        return successResponse(base('no_plan_credit_available', specialtyCode, lookup.externalSpecializationId, requestedPlanId || lookup.planIds[0] || null), requestId, { status: 200, cors: CORS });
      }
      const result = {
        ...base('plan_credit_available', specialtyCode, coverage.externalSpecializationId, coverage.externalPlanId),
        external_subscription_id: coverage.internalSubscriptionId,
        external_subscription_score_id: coverage.internalSubscriptionScoreId,
        external_score_id: coverage.internalScoreId,
        raw_status: coverage.rawStatus,
      };
      console.info('[check-plan-coverage] coverage:checked', { requestId, plansProvider: 'internal', flow, specialtyCode, subscriptionScoreId: coverage.internalSubscriptionScoreId, covered: true });
      return successResponse(result, requestId, { status: 200, cors: CORS });
    } catch (error) {
      console.warn('[check-plan-coverage] internal-plans:unavailable', { requestId, plansProvider: 'internal', flow, specialtyCode, errorCode: error instanceof AppError ? error.code : 'UNEXPECTED_ERROR' });
      return successResponse(base('plans_service_unavailable', specialtyCode, lookup.externalSpecializationId, requestedPlanId || lookup.planIds[0] || null), requestId, { status: 200, cors: CORS });
    }
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}

export const checkPlanCoverageHandler = (req: Request) => handleCheckPlanCoverageRequest(req);
Deno.serve(checkPlanCoverageHandler);
