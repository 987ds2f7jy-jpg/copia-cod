import { createRequestId, ensureMethod, errorResponse, handlePreflight, readJsonBody, successResponse } from '../_shared/http.ts';
import { createServiceRoleClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';

const FUNCTION_NAME = 'get-booking-data';
const CORS = { allowedMethods: ['POST'] };

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
    const professionalId = String(body?.professionalId || '').trim();
    if (!professionalId) {
      throw new AppError({ status: 400, code: 'PROFESSIONAL_ID_REQUIRED', message: '"professionalId" is required.' });
    }

    const client = createServiceRoleClient();

    const { data: publicProfile, error: publicProfileError } = await client
      .from('professional_public_profiles')
      .select('*')
      .eq('id', professionalId)
      .eq('status', 'approved')
      .maybeSingle();

    if (publicProfileError || !publicProfile) {
      throw new AppError({ status: 404, code: 'PROFESSIONAL_NOT_FOUND', message: 'Professional not found.' });
    }

    const privateProfileId = publicProfile.professional_profile_id || professionalId;

    const [availabilityRes, appointmentsRes, reviewsRes, questionsRes] = await Promise.all([
      client.from('availability_slots').select('*').eq('professional_id', privateProfileId),
      client.from('appointments').select('*').eq('professional_id', privateProfileId).order('scheduled_datetime', { ascending: false }).limit(200),
      client.from('reviews').select('*').eq('professional_id', privateProfileId).order('created_date', { ascending: false }).limit(100),
      client.from('questions').select('*').eq('public_profile_id', publicProfile.id).eq('status', 'RESPONDIDA').order('answered_at', { ascending: false }).limit(100),
    ]);

    if (availabilityRes.error || appointmentsRes.error || reviewsRes.error || questionsRes.error) {
      throw new AppError({
        status: 500,
        code: 'BOOKING_READ_FAILED',
        message: 'Unable to load booking data.',
      });
    }

    return successResponse({
      publicProfile,
      privateProfileId,
      availabilitySlots: availabilityRes.data || [],
      appointments: appointmentsRes.data || [],
      reviews: reviewsRes.data || [],
      questions: questionsRes.data || [],
    }, requestId, { cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
});
