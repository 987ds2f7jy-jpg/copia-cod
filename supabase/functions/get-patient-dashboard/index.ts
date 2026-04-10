import { requireAuthenticatedUser } from '../_shared/auth.ts';
import { createRequestId, ensureMethod, errorResponse, handlePreflight, readJsonBody, successResponse } from '../_shared/http.ts';
import { createServiceRoleClient, createSupabaseAuthUserLookup } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';

const FUNCTION_NAME = 'get-patient-dashboard';
const CORS = { allowedMethods: ['POST'] };

function normalizeLimit(value: unknown, fallback = 200) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.trunc(parsed), 500);
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req, CORS);
  if (preflight) return preflight;

  const requestId = createRequestId();
  const methodError = ensureMethod(req, {
    allowedMethods: ['POST'],
    functionName: FUNCTION_NAME,
    requestId,
    cors: CORS,
  });
  if (methodError) return methodError;

  try {
    const body = await readJsonBody<Record<string, unknown>>(req);
    const client = createServiceRoleClient();
    const authUser = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
    const appointmentsLimit = normalizeLimit(body?.appointmentsLimit, 300);
    const reviewsLimit = normalizeLimit(body?.reviewsLimit, 200);

    const { data: appUser, error: appUserError } = await client
      .from('app_users')
      .select('id')
      .eq('auth_user_id', authUser.authUserId)
      .maybeSingle();

    if (appUserError || !appUser?.id) {
      throw new AppError({
        status: 404,
        code: 'APP_USER_NOT_FOUND',
        message: 'Application user not found.',
      });
    }

    const patientId = appUser.id;

    const [appointmentsRes, reviewsRes, consultasRes] = await Promise.all([
      client
        .from('appointments')
        .select('*')
        .eq('patient_id', patientId)
        .order('scheduled_datetime', { ascending: false })
        .limit(appointmentsLimit),
      client
        .from('reviews')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_date', { ascending: false })
        .limit(reviewsLimit),
      client
        .from('consultas')
        .select('*')
        .eq('paciente_id', patientId)
        .order('created_date', { ascending: false })
        .limit(50),
    ]);

    if (appointmentsRes.error || reviewsRes.error || consultasRes.error) {
      throw new AppError({
        status: 500,
        code: 'PATIENT_DASHBOARD_READ_FAILED',
        message: 'Unable to load patient dashboard.',
        details: {
          appointments: appointmentsRes.error?.message,
          reviews: reviewsRes.error?.message,
          consultas: consultasRes.error?.message,
        },
      });
    }

    return successResponse({
      patientId,
      appointments: appointmentsRes.data || [],
      reviews: reviewsRes.data || [],
      consultas: consultasRes.data || [],
    }, requestId, { cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
});
