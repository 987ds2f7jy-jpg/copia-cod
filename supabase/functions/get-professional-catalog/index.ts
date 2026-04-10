import { createRequestId, ensureMethod, errorResponse, handlePreflight, readJsonBody, successResponse } from '../_shared/http.ts';
import { createServiceRoleClient } from '../_shared/supabase.ts';

const FUNCTION_NAME = 'get-professional-catalog';
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
    const specialty = String(body?.specialty || '').trim();
    const searchTerm = String(body?.searchTerm || '').trim().toLowerCase();
    const onlyActive = body?.onlyActive !== false;

    const client = createServiceRoleClient();
    let query = client
      .from('professional_public_profiles')
      .select('*')
      .eq('status', 'approved')
      .order('created_date', { ascending: false })
      .limit(400);

    if (onlyActive) {
      query = query.eq('perfil_ativo', true);
    }
    if (specialty) {
      query = query.eq('specialty', specialty);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const professionals = (data || []).filter((item) => {
      if (!searchTerm) return true;
      const fullName = String(item.full_name || '').toLowerCase();
      const profSpecialty = String(item.specialty || '').toLowerCase();
      return fullName.includes(searchTerm) || profSpecialty.includes(searchTerm);
    });

    return successResponse({ professionals }, requestId, { cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
});
