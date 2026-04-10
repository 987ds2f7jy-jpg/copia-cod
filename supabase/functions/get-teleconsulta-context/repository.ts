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

type ProfessionalRow = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  specialty: string | null;
};

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
        source: 'professional_profiles',
      };
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
