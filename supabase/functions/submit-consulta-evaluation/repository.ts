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
} from '../_shared/teleconsulta.ts';
import type {
  AppointmentLinkRecord,
  ReviewRecord,
  SubmitConsultaEvaluationRepository,
} from './types.ts';

function createSubmitConsultaEvaluationRepository(client: SupabaseClient): SubmitConsultaEvaluationRepository {
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
          message: 'Unable to verify consultation evaluation.',
          details: error.message,
        });
      }

      return (data as ConsultaEvaluationRow | null) || null;
    },

    async createConsultaEvaluation(params): Promise<ConsultaEvaluationRow> {
      const { data, error } = await client
        .from('avaliacao_consulta')
        .insert({
          consulta_id: params.consultationId,
          paciente_id: params.patientId,
          profissional_id: params.professionalId,
          nota: params.rating,
          comentario: params.comment,
        })
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
        .single();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'CONSULTA_EVALUATION_CREATE_FAILED',
          message: 'Unable to save consultation evaluation.',
          details: error.message,
        });
      }

      return data as ConsultaEvaluationRow;
    },

    async findAppointmentByConsultationId(consultationId: string): Promise<AppointmentLinkRecord | null> {
      const { data, error } = await client
        .from('appointments')
        .select('id, patient_id, professional_id, status')
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
        .select('id, patient_id, professional_id, status')
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

    async findExistingReview({ appointmentId, patientId }): Promise<ReviewRecord | null> {
      const { data, error } = await client
        .from('reviews')
        .select(`
          id,
          appointment_id,
          patient_id,
          patient_name,
          professional_id,
          rating,
          comment,
          created_date,
          updated_at
        `)
        .eq('appointment_id', appointmentId)
        .eq('patient_id', patientId)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'REVIEW_LOOKUP_FAILED',
          message: 'Unable to verify existing appointment review.',
          details: error.message,
        });
      }

      return (data as ReviewRecord | null) || null;
    },

    async createReview(params): Promise<ReviewRecord> {
      const { data, error } = await client
        .from('reviews')
        .insert({
          appointment_id: params.appointmentId,
          patient_id: params.patientId,
          patient_name: params.patientName,
          professional_id: params.professionalId,
          rating: params.rating,
          comment: params.comment,
        })
        .select(`
          id,
          appointment_id,
          patient_id,
          patient_name,
          professional_id,
          rating,
          comment,
          created_date,
          updated_at
        `)
        .single();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'REVIEW_CREATE_FAILED',
          message: 'Unable to create appointment review.',
          details: error.message,
        });
      }

      return data as ReviewRecord;
    },

    async listReviewsByProfessionalId(professionalId: string): Promise<ReviewRecord[]> {
      const { data, error } = await client
        .from('reviews')
        .select(`
          id,
          appointment_id,
          patient_id,
          patient_name,
          professional_id,
          rating,
          comment,
          created_date,
          updated_at
        `)
        .eq('professional_id', professionalId);

      if (error) {
        throw new AppError({
          status: 500,
          code: 'REVIEW_AGGREGATE_LOOKUP_FAILED',
          message: 'Unable to recalculate review metrics.',
          details: error.message,
        });
      }

      return (data as ReviewRecord[] | null) || [];
    },

    async updateProfessionalReviewStats({ professionalId, averageRating, totalReviews }): Promise<void> {
      const [privateResult, publicResult] = await Promise.all([
        client
          .from('professional_profiles')
          .update({
            rating: averageRating,
            total_reviews: totalReviews,
          })
          .eq('id', professionalId),
        client
          .from('professional_public_profiles')
          .update({
            rating: averageRating,
            total_reviews: totalReviews,
          })
          .eq('professional_profile_id', professionalId),
      ]);

      if (privateResult.error) {
        throw new AppError({
          status: 500,
          code: 'PRIVATE_REVIEW_METRICS_UPDATE_FAILED',
          message: 'Unable to update professional review metrics.',
          details: privateResult.error.message,
        });
      }

      if (publicResult.error) {
        throw new AppError({
          status: 500,
          code: 'PUBLIC_REVIEW_METRICS_UPDATE_FAILED',
          message: 'Unable to update professional public review metrics.',
          details: publicResult.error.message,
        });
      }
    },
  };
}

export function createSubmitConsultaEvaluationRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createSubmitConsultaEvaluationRepository(client),
  };
}
