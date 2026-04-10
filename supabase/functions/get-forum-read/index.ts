import { requireAuthenticatedUser } from '../_shared/auth.ts';
import { createRequestId, ensureMethod, errorResponse, handlePreflight, readJsonBody, successResponse } from '../_shared/http.ts';
import { createServiceRoleClient, createSupabaseAuthUserLookup } from '../_shared/supabase.ts';

const FUNCTION_NAME = 'get-forum-read';
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
    const filterSpecialty = String(body?.filterSpecialty || '').trim();
    const includeMine = Boolean(body?.includeMine);
    const includePublic = body?.includePublic !== false;

    const client = createServiceRoleClient();
    const publicProfilesQuery = client
      .from('professional_public_profiles')
      .select('*')
      .eq('status', 'approved')
      .order('created_date', { ascending: false })
      .limit(300);

    const publicQuestionsQuery = includePublic
      ? client
        .from('questions')
        .select('*')
        .eq('status', 'RESPONDIDA')
        .order('answered_at', { ascending: false })
        .limit(100)
      : Promise.resolve({ data: [], error: null });

    let myQuestionsPromise: Promise<{ data: unknown[]; error: unknown }>;
    if (includeMine) {
      const authUser = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
      const { data: appUser } = await client.from('app_users').select('id').eq('auth_user_id', authUser.authUserId).maybeSingle();
      const patientId = appUser?.id || '';
      myQuestionsPromise = patientId
        ? client.from('questions').select('*').eq('paciente_id', patientId).order('created_date', { ascending: false }).limit(100)
        : Promise.resolve({ data: [], error: null });
    } else {
      myQuestionsPromise = Promise.resolve({ data: [], error: null });
    }

    const [profilesRes, publicRes, myRes] = await Promise.all([
      publicProfilesQuery,
      publicQuestionsQuery,
      myQuestionsPromise,
    ]);

    if (profilesRes.error || (publicRes as any).error || (myRes as any).error) {
      throw new Error('Unable to load forum data.');
    }

    const normalizedFilter = filterSpecialty && filterSpecialty !== 'Todas' ? filterSpecialty : '';
    const publicQuestions = ((publicRes as any).data || []).filter((item: any) => (
      !normalizedFilter || item.specialty === normalizedFilter
    ));

    return successResponse({
      professionalPublicProfiles: profilesRes.data || [],
      publicQuestions,
      myQuestions: (myRes as any).data || [],
    }, requestId, { cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
});
