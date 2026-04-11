import { AppError } from './errors.ts';
import {
  requireActiveSessionAccount,
  type SessionAccountRecord,
} from './sessionAccount.ts';
import {
  createServiceRoleClient,
  type SupabaseClient,
} from './supabase.ts';

export type ConsultationParticipantRole = 'patient' | 'professional';

export type ConsultationRecord = {
  id: string;
  paciente_id: string;
  paciente_nome?: string | null;
  profissional_id: string;
  profissional_user_id?: string | null;
  profissional_nome?: string | null;
  status: string;
  sala_id?: string | null;
  token_sala?: string | null;
};

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

export async function fetchConsultationById(
  client: SupabaseClient,
  consultationId: string,
) {
  const { data, error } = await client
    .from('consultas')
    .select('id, paciente_id, paciente_nome, profissional_id, profissional_user_id, profissional_nome, status, sala_id, token_sala')
    .eq('id', consultationId)
    .maybeSingle();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'CONSULTATION_LOOKUP_FAILED',
      message: 'Unable to load consultation.',
      details: error.message,
    });
  }

  if (!data?.id) {
    throw new AppError({
      status: 404,
      code: 'CONSULTATION_NOT_FOUND',
      message: 'Consulta nao encontrada.',
    });
  }

  return data as ConsultationRecord;
}

async function fetchProfessionalParticipantIds(
  client: SupabaseClient,
  appUserId: string,
) {
  const participantIds = new Set<string>([appUserId]);

  const { data, error } = await client
    .from('professional_profiles')
    .select('id')
    .eq('user_id', appUserId)
    .limit(10);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PROFESSIONAL_PROFILE_LOOKUP_FAILED',
      message: 'Unable to resolve professional profiles.',
      details: error.message,
    });
  }

  for (const row of data || []) {
    if (row?.id) {
      participantIds.add(row.id);
    }
  }

  return participantIds;
}

export async function resolveConsultationParticipantRole(
  client: SupabaseClient,
  consultation: ConsultationRecord,
  appUser: SessionAccountRecord,
): Promise<ConsultationParticipantRole | null> {
  if (consultation.paciente_id === appUser.id) {
    return 'patient';
  }

  const professionalIds = await fetchProfessionalParticipantIds(client, appUser.id);

  if (
    professionalIds.has(consultation.profissional_id) ||
    professionalIds.has(normalizeString(consultation.profissional_user_id)) ||
    consultation.profissional_user_id === appUser.id ||
    consultation.profissional_id === appUser.id
  ) {
    return 'professional';
  }

  return null;
}

export async function requireConsultationAccess({
  req,
  consultationId,
  client = createServiceRoleClient(),
  allowedRoles,
}: {
  req: Request;
  consultationId: string;
  client?: SupabaseClient;
  allowedRoles?: ConsultationParticipantRole[];
}) {
  const normalizedConsultationId = normalizeString(consultationId);

  if (!normalizedConsultationId) {
    throw new AppError({
      status: 400,
      code: 'CONSULTATION_ID_REQUIRED',
      message: '"consultationId" is required.',
    });
  }

  const appUser = await requireActiveSessionAccount(req, client);
  const consultation = await fetchConsultationById(client, normalizedConsultationId);
  const participantRole = await resolveConsultationParticipantRole(client, consultation, appUser);

  if (!participantRole) {
    throw new AppError({
      status: 403,
      code: 'CONSULTATION_FORBIDDEN',
      message: 'Usuario nao participa desta consulta.',
    });
  }

  if (allowedRoles?.length && !allowedRoles.includes(participantRole)) {
    throw new AppError({
      status: 403,
      code: 'CONSULTATION_ROLE_FORBIDDEN',
      message: 'Usuario nao possui permissao para esta acao.',
      details: {
        allowedRoles,
        participantRole,
      },
    });
  }

  return {
    appUser,
    consultation,
    participantRole,
  };
}
