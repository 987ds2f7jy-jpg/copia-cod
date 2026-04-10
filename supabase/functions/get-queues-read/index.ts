import { requireAuthenticatedUser } from '../_shared/auth.ts';
import { createRequestId, ensureMethod, errorResponse, handlePreflight, readJsonBody, successResponse } from '../_shared/http.ts';
import { createServiceRoleClient, createSupabaseAuthUserLookup } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';

const FUNCTION_NAME = 'get-queues-read';
const CORS = { allowedMethods: ['POST'] };
const ACTIVE_QUEUE_STATUSES = ['waiting', 'in_progress', 'em_atendimento'];

async function resolvePatientId(client: ReturnType<typeof createServiceRoleClient>, req: Request) {
  const authUser = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
  const { data: appUser, error } = await client
    .from('app_users')
    .select('id')
    .eq('auth_user_id', authUser.authUserId)
    .maybeSingle();
  if (error || !appUser?.id) {
    throw new AppError({ status: 404, code: 'APP_USER_NOT_FOUND', message: 'Application user not found.' });
  }
  return appUser.id as string;
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
    const action = String(body?.action || 'overview');
    const specialty = String(body?.specialty || '').trim();
    const queueId = String(body?.queueId || '').trim();
    const patientIdFromBody = String(body?.patientId || '').trim();
    const professionalSpecialty = String(body?.professionalSpecialty || '').trim();

    const client = createServiceRoleClient();

    if (action === 'overview') {
      const patientId = patientIdFromBody || await resolvePatientId(client, req);

      const [publicRes, queueRes, consultasRes, queueAllRes] = await Promise.all([
        client
          .from('professional_public_profiles')
          .select('*')
          .eq('is_on_duty', true)
          .eq('status', 'approved')
          .limit(300),
        specialty
          ? client
            .from('queue')
            .select('*')
            .eq('specialty', specialty)
            .in('status', ACTIVE_QUEUE_STATUSES)
            .order('created_date', { ascending: true })
            .limit(100)
          : client
            .from('queue')
            .select('*')
            .in('status', ACTIVE_QUEUE_STATUSES)
            .order('created_date', { ascending: true })
            .limit(100),
        client
          .from('consultas')
          .select('*')
          .eq('paciente_id', patientId)
          .in('status', ['aguardando', 'em_atendimento', 'in_progress'])
          .order('created_date', { ascending: false })
          .limit(20),
        client
          .from('queue')
          .select('*')
          .eq('patient_id', patientId)
          .in('status', ACTIVE_QUEUE_STATUSES)
          .order('created_date', { ascending: false })
          .limit(20),
      ]);

      if (publicRes.error || queueRes.error || consultasRes.error || queueAllRes.error) {
        throw new Error('Unable to load queue overview.');
      }

      const currentQueueEntry = queueId
        ? ((queueAllRes.data || []).find((item) => item.id === queueId) || null)
        : ((queueAllRes.data || [])[0] || null);
      const activeConsulta = (consultasRes.data || [])[0] || null;

      return successResponse({
        onDutyProfessionals: publicRes.data || [],
        queueStats: {
          count: (queueRes.data || []).filter((item) => item.status === 'waiting').length,
          estimatedWait: ((queueRes.data || []).filter((item) => item.status === 'waiting').length) * 10,
        },
        currentQueueEntry,
        activeConsulta,
      }, requestId, { cors: CORS });
    }

    if (action === 'current-entry') {
      const patientId = patientIdFromBody || await resolvePatientId(client, req);
      const filters = client
        .from('queue')
        .select('*')
        .eq('patient_id', patientId)
        .in('status', ACTIVE_QUEUE_STATUSES)
        .order('created_date', { ascending: false })
        .limit(20);

      const { data, error } = await filters;
      if (error) throw error;
      const currentEntry = specialty
        ? (data || []).find((item) => item.specialty === specialty) || null
        : (data || [])[0] || null;
      return successResponse({ currentEntry }, requestId, { cors: CORS });
    }

    if (action === 'direct-solicitacoes') {
      const profSpec = professionalSpecialty.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      if (profSpec !== 'clinico_geral') {
        return successResponse({ solicitacoes: [] }, requestId, { cors: CORS });
      }
      const { data, error } = await client
        .from('solicitacoes_exame')
        .select('*')
        .eq('status', 'pending')
        .eq('fluxo_destino', 'dashboard')
        .eq('especialidade_destino', 'clinico_geral')
        .order('created_date', { ascending: false });
      if (error) throw error;
      return successResponse({ solicitacoes: data || [] }, requestId, { cors: CORS });
    }

    if (action === 'resolve-laudo') {
      const queueEntry = (body?.queueEntry || {}) as Record<string, unknown>;
      const queueEntryId = String(queueEntry.id || '').trim();
      const queuePatientId = String(queueEntry.patient_id || '').trim();
      const solicitacaoExameId = String(queueEntry.solicitacao_exame_id || '').trim();
      if (!queuePatientId) {
        return successResponse({ solicitacao: null }, requestId, { cors: CORS });
      }

      if (solicitacaoExameId) {
        const { data } = await client.from('solicitacoes_exame').select('*').eq('id', solicitacaoExameId).maybeSingle();
        if (data) return successResponse({ solicitacao: data }, requestId, { cors: CORS });
      }

      if (queueEntryId) {
        const { data } = await client
          .from('solicitacoes_exame')
          .select('*')
          .eq('queue_id', queueEntryId)
          .eq('tipo', 'laudo_medico')
          .order('created_date', { ascending: false })
          .limit(1);
        if (data?.[0]) return successResponse({ solicitacao: data[0] }, requestId, { cors: CORS });
      }

      const { data } = await client
        .from('solicitacoes_exame')
        .select('*')
        .eq('paciente_id', queuePatientId)
        .eq('tipo', 'laudo_medico')
        .in('status', ['pending', 'in_progress'])
        .order('created_date', { ascending: false })
        .limit(1);

      return successResponse({ solicitacao: data?.[0] || null }, requestId, { cors: CORS });
    }

    throw new AppError({ status: 400, code: 'ACTION_INVALID', message: 'Invalid queues read action.' });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
});
