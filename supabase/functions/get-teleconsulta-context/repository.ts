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
  ConsultaEvaluationRow,
  PatientSummaryRow,
  ProfessionalIdentityRow,
  ProntuarioRow,
} from '../_shared/teleconsulta.ts';
import type { GetTeleconsultaContextRepository } from './types.ts';
import type { AppointmentPaymentRecord } from './types.ts';

type ProfessionalRow = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  specialty: string | null;
  status?: string | null;
};

function collectPatientIds(
  rows: Array<Record<string, unknown>> | null,
  field: 'paciente_id' | 'patient_id',
  target: Set<string>,
) {
  (rows || []).forEach((row) => {
    const patientId = String(row[field] || '').trim();
    if (patientId) target.add(patientId);
  });
}

function createGetTeleconsultaContextRepository(client: SupabaseClient): GetTeleconsultaContextRepository {
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
      const { data, error } = await client
        .from('professional_profiles')
        .select('id, user_id, full_name, specialty, status')
        .eq('user_id', appUserId)
        .eq('status', 'approved')
        .order('created_date', { ascending: false });

      if (error) {
        throw new AppError({
          status: 500,
          code: 'PROFESSIONAL_IDENTITY_LOOKUP_FAILED',
          message: 'Unable to resolve professional identity.',
          details: error.message,
        });
      }

      const rows = (data as ProfessionalRow[] | null) || [];
      const row = rows[0] || null;

      if (!row?.id) {
        return null;
      }

      return {
        profileId: row.id,
        profileIds: rows.map((item) => item.id).filter(Boolean),
        appUserId: row.user_id || null,
        fullName: row.full_name || '',
        specialty: row.specialty || '',
        source: 'professional_profiles',
      };
    },

    async listAuthorizedPatientIdsForProfessional({
      appUserId,
      professionalProfileIds,
      patientIds,
    }): Promise<string[]> {
      if (professionalProfileIds.length === 0 || patientIds.length === 0) {
        return [];
      }

      const results = await Promise.all([
        client
          .from('consultas')
          .select('paciente_id')
          .in('paciente_id', patientIds)
          .in('profissional_id', professionalProfileIds)
          .in('status', ['aguardando', 'em_atendimento', 'in_progress', 'finalizada']),
        client
          .from('consultas')
          .select('paciente_id')
          .in('paciente_id', patientIds)
          .eq('profissional_user_id', appUserId)
          .in('status', ['aguardando', 'em_atendimento', 'in_progress', 'finalizada']),
        client
          .from('appointments')
          .select('patient_id')
          .in('patient_id', patientIds)
          .in('professional_id', professionalProfileIds)
          .in('status', ['accepted', 'confirmed', 'CONFIRMADO', 'in_progress', 'em_atendimento', 'completed', 'CONCLUIDO']),
        client
          .from('queues')
          .select('patient_id')
          .in('patient_id', patientIds)
          .in('assigned_professional_id', professionalProfileIds)
          .in('status', ['assigned', 'in_progress', 'em_atendimento', 'completed']),
        client
          .from('solicitacoes_exames')
          .select('paciente_id')
          .in('paciente_id', patientIds)
          .in('medico_id', professionalProfileIds)
          .in('status', ['in_progress', 'completed']),
      ]);

      const failedResult = results.find((result) => result.error);

      if (failedResult?.error) {
        throw new AppError({
          status: 500,
          code: 'CLINICAL_RELATIONSHIP_LOOKUP_FAILED',
          message: 'Unable to validate professional care relationship.',
          details: failedResult.error.message,
        });
      }

      const authorized = new Set<string>();
      collectPatientIds(results[0].data as Array<Record<string, unknown>> | null, 'paciente_id', authorized);
      collectPatientIds(results[1].data as Array<Record<string, unknown>> | null, 'paciente_id', authorized);
      collectPatientIds(results[2].data as Array<Record<string, unknown>> | null, 'patient_id', authorized);
      collectPatientIds(results[3].data as Array<Record<string, unknown>> | null, 'patient_id', authorized);
      collectPatientIds(results[4].data as Array<Record<string, unknown>> | null, 'paciente_id', authorized);

      return patientIds.filter((patientId) => authorized.has(patientId));
    },

    async findPaymentOwnerByConsultationId(consultationId: string): Promise<AppointmentPaymentRecord | null> {
      const { data, error } = await client
        .from('appointments')
        .select(`
          id,
          payment_required,
          payment_status,
          current_payment_charge_id,
          gross_price,
          platform_fee_percent,
          platform_fee_amount,
          professional_net_amount
        `)
        .eq('consulta_id', consultationId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        throw new AppError({
          status: 500,
          code: 'CONSULTATION_PAYMENT_LOOKUP_FAILED',
          message: 'Unable to load consultation payment state.',
          details: error.message,
        });
      }

      return ((data?.[0] as AppointmentPaymentRecord | undefined) || null);
    },

    async closeExpiredConsultation({ consultationId, finishedAt }) {
      const { error } = await client
        .from('consultas')
        .update({
          status: 'finalizada',
          fim_at: finishedAt,
        })
        .eq('id', consultationId)
        .in('status', ['aguardando', 'em_atendimento', 'in_progress']);

      if (error) {
        throw new AppError({
          status: 500,
          code: 'EXPIRED_CONSULTATION_CLOSE_FAILED',
          message: 'Unable to close expired telemedicine consultation.',
          details: error.message,
        });
      }
    },

    async completeAppointmentsByConsultationId(consultationId: string) {
      const { error } = await client
        .from('appointments')
        .update({ status: 'completed' })
        .eq('consulta_id', consultationId)
        .not('status', 'in', '(completed,cancelled,CONCLUIDO,CANCELADO)');

      if (error) {
        throw new AppError({
          status: 500,
          code: 'EXPIRED_CONSULTATION_APPOINTMENTS_CLOSE_FAILED',
          message: 'Unable to reconcile expired appointment records.',
          details: error.message,
        });
      }
    },

    async completeQueueEntriesByConsultation(consultation: ConsultationRow) {
      if (consultation.tipo_consulta !== 'plantao') {
        return;
      }

      const { error } = await client
        .from('queues')
        .update({ status: 'completed' })
        .eq('patient_id', consultation.paciente_id)
        .eq('assigned_professional_id', consultation.profissional_id)
        .eq('specialty', consultation.especialidade || '')
        .in('status', ['assigned', 'waiting', 'in_progress', 'em_atendimento']);

      if (error) {
        throw new AppError({
          status: 500,
          code: 'EXPIRED_CONSULTATION_QUEUE_CLOSE_FAILED',
          message: 'Unable to reconcile expired queue entries.',
          details: error.message,
        });
      }
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

    async listPatientProntuarios({ patientId, historyLimit, excludeConsultationId }): Promise<ProntuarioRow[]> {
      let query = client
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
        .eq('paciente_id', patientId)
        .order('created_date', { ascending: false })
        .limit(historyLimit);

      if (excludeConsultationId) {
        query = query.neq('consulta_id', excludeConsultationId);
      }

      const { data, error } = await query;

      if (error) {
        throw new AppError({
          status: 500,
          code: 'PATIENT_PRONTUARIOS_LOOKUP_FAILED',
          message: 'Unable to load patient medical records.',
          details: error.message,
        });
      }

      return (data as ProntuarioRow[] | null) || [];
    },

    async findConsultaEvaluation({ consultationId, patientId }): Promise<ConsultaEvaluationRow | null> {
      const { data, error } = await client
        .from('avaliacao_consulta')
        .select(`
          id,
          consulta_id,
          paciente_id,
          profissional_id,
          nota,
          comentario,
          created_date,
          updated_at
        `)
        .eq('consulta_id', consultationId)
        .eq('paciente_id', patientId)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'CONSULTA_EVALUATION_LOOKUP_FAILED',
          message: 'Unable to load consultation evaluation.',
          details: error.message,
        });
      }

      return (data as ConsultaEvaluationRow | null) || null;
    },

    async findPatientById(patientId: string): Promise<PatientSummaryRow | null> {
      const { data, error } = await client
        .from('app_users')
        .select('id, full_name, birth_date, sex')
        .eq('id', patientId)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'PATIENT_LOOKUP_FAILED',
          message: 'Unable to load patient summary.',
          details: error.message,
        });
      }

      return (data as PatientSummaryRow | null) || null;
    },

    async listPatientsByIds(patientIds: string[]): Promise<PatientSummaryRow[]> {
      if (patientIds.length === 0) {
        return [];
      }

      const { data, error } = await client
        .from('app_users')
        .select('id, full_name, birth_date, sex')
        .in('id', patientIds);

      if (error) {
        throw new AppError({
          status: 500,
          code: 'PATIENTS_LOOKUP_FAILED',
          message: 'Unable to load requested patient summaries.',
          details: error.message,
        });
      }

      return (data as PatientSummaryRow[] | null) || [];
    },

    async listLatestProntuariosByPatientIds(patientIds: string[]): Promise<ProntuarioRow[]> {
      if (patientIds.length === 0) {
        return [];
      }

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
        .in('paciente_id', patientIds)
        .order('created_date', { ascending: false });

      if (error) {
        throw new AppError({
          status: 500,
          code: 'LATEST_PRONTUARIOS_LOOKUP_FAILED',
          message: 'Unable to load latest patient medical records.',
          details: error.message,
        });
      }

      return (data as ProntuarioRow[] | null) || [];
    },
  };
}

export function createGetTeleconsultaContextRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createGetTeleconsultaContextRepository(client),
  };
}
