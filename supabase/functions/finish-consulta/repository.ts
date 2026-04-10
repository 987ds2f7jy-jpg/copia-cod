import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { findAppUserByAuthUserId } from '../_shared/appUsers.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  ConsultationRow,
  ProfessionalIdentityRow,
  ProntuarioRow,
} from '../_shared/teleconsulta.ts';
import type {
  AppointmentLinkRecord,
  FinishConsultaRepository,
  QueueLinkRecord,
} from './types.ts';

type ProfessionalRow = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  specialty: string | null;
};

function createFinishConsultaRepository(client: SupabaseClient): FinishConsultaRepository {
  return {
    async findAppUserByAuthUserId(authUserId: string) {
      return findAppUserByAuthUserId(client, authUserId);
    },

    async findConsultationById(consultationId: string): Promise<ConsultationRow | null> {
      const { data, error } = await client
        .from('consultas')
        .select(`
          id,
          paciente_id,
          paciente_nome,
          paciente_email,
          profissional_id,
          profissional_user_id,
          profissional_nome,
          especialidade,
          tipo_consulta,
          status,
          datetime,
          descricao_sintomas,
          inicio_at,
          fim_at,
          sala_id,
          token_sala,
          preco
        `)
        .eq('id', consultationId)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'CONSULTATION_LOOKUP_FAILED',
          message: 'Unable to load telemedicine consultation.',
          details: error.message,
        });
      }

      return (data as ConsultationRow | null) || null;
    },

    async findProfessionalIdentityByAppUserId(appUserId: string): Promise<ProfessionalIdentityRow | null> {
      const load = async (tableName: 'professional_profiles' | 'professionals') => {
        const { data, error } = await client
          .from(tableName)
          .select('id, user_id, full_name, specialty')
          .eq('user_id', appUserId)
          .order('created_date', { ascending: false })
          .limit(1);

        if (error) {
          throw new AppError({
            status: 500,
            code: 'PROFESSIONAL_IDENTITY_LOOKUP_FAILED',
            message: 'Unable to resolve professional identity.',
            details: error.message,
          });
        }

        const row = (data?.[0] || null) as ProfessionalRow | null;

        if (!row?.id) {
          return null;
        }

        return {
          profileId: row.id,
          appUserId: row.user_id || null,
          fullName: row.full_name || '',
          specialty: row.specialty || '',
          source: tableName,
        } satisfies ProfessionalIdentityRow;
      };

      return (await load('professional_profiles')) || (await load('professionals'));
    },

    async findProntuarioByConsultationId(consultationId: string): Promise<ProntuarioRow | null> {
      const { data, error } = await client
        .from('prontuarios')
        .select(`
          id,
          consulta_id,
          paciente_id,
          profissional_id,
          modo,
          motivo_consulta,
          historico_risco,
          exames_imagem,
          exame_fisico,
          avaliacao_diagnostico,
          recomendacoes,
          created_date,
          updated_at
        `)
        .eq('consulta_id', consultationId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        throw new AppError({
          status: 500,
          code: 'PRONTUARIO_LOOKUP_FAILED',
          message: 'Unable to load consultation medical record.',
          details: error.message,
        });
      }

      return ((data?.[0] as ProntuarioRow | undefined) || null);
    },

    async updateConsultationFinish(params): Promise<ConsultationRow> {
      const { data, error } = await client
        .from('consultas')
        .update({
          status: params.status,
          inicio_at: params.startedAt,
          fim_at: params.finishedAt,
          sala_id: params.roomId,
          token_sala: params.roomToken,
        })
        .eq('id', params.consultationId)
        .select(`
          id,
          paciente_id,
          paciente_nome,
          paciente_email,
          profissional_id,
          profissional_user_id,
          profissional_nome,
          especialidade,
          tipo_consulta,
          status,
          datetime,
          descricao_sintomas,
          inicio_at,
          fim_at,
          sala_id,
          token_sala,
          preco
        `)
        .single();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'CONSULTATION_FINISH_UPDATE_FAILED',
          message: 'Unable to finish consultation.',
          details: error.message,
        });
      }

      return data as ConsultationRow;
    },

    async findAppointmentByConsultationId(consultationId: string): Promise<AppointmentLinkRecord | null> {
      const { data, error } = await client
        .from('appointments')
        .select('id, status')
        .eq('consulta_id', consultationId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        throw new AppError({
          status: 500,
          code: 'APPOINTMENT_BY_CONSULTATION_LOOKUP_FAILED',
          message: 'Unable to load related appointment.',
          details: error.message,
        });
      }

      return ((data?.[0] as AppointmentLinkRecord | undefined) || null);
    },

    async updateAppointmentStatus({ appointmentId, status }): Promise<AppointmentLinkRecord> {
      const { data, error } = await client
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId)
        .select('id, status')
        .single();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'APPOINTMENT_STATUS_UPDATE_FAILED',
          message: 'Unable to update related appointment status.',
          details: error.message,
        });
      }

      return data as AppointmentLinkRecord;
    },

    async findQueueEntryByConsultation(consultation: ConsultationRow): Promise<QueueLinkRecord | null> {
      if (consultation.tipo_consulta !== 'plantao') {
        return null;
      }

      const { data, error } = await client
        .from('queues')
        .select('id, status')
        .eq('patient_id', consultation.paciente_id)
        .eq('assigned_professional_id', consultation.profissional_id)
        .eq('specialty', consultation.especialidade || '')
        .in('status', ['assigned', 'waiting', 'in_progress', 'em_atendimento'])
        .order('created_date', { ascending: false })
        .limit(1);

      if (error) {
        throw new AppError({
          status: 500,
          code: 'QUEUE_BY_CONSULTATION_LOOKUP_FAILED',
          message: 'Unable to load related queue entry.',
          details: error.message,
        });
      }

      return ((data?.[0] as QueueLinkRecord | undefined) || null);
    },

    async updateQueueStatus({ queueId, status }): Promise<QueueLinkRecord> {
      const { data, error } = await client
        .from('queues')
        .update({ status })
        .eq('id', queueId)
        .select('id, status')
        .single();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'QUEUE_STATUS_UPDATE_FAILED',
          message: 'Unable to update related queue entry status.',
          details: error.message,
        });
      }

      return data as QueueLinkRecord;
    },
  };
}

export function createFinishConsultaRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createFinishConsultaRepository(client),
  };
}
