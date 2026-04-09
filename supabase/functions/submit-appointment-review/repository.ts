import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { findAppUserByAuthUserId } from '../_shared/appUsers.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  AppointmentRecord,
  ReviewRecord,
  SubmitAppointmentReviewRepository,
} from './types.ts';

function createSubmitAppointmentReviewRepository(client: SupabaseClient): SubmitAppointmentReviewRepository {
  return {
    async findAppUserByAuthUserId(authUserId: string) {
      return findAppUserByAuthUserId(client, authUserId);
    },

    async findAppointmentById(appointmentId: string): Promise<AppointmentRecord | null> {
      const { data, error } = await client
        .from('appointments')
        .select('id, patient_id, professional_id, professional_name, status')
        .eq('id', appointmentId)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'APPOINTMENT_LOOKUP_FAILED',
          message: 'Unable to load appointment.',
          details: error.message,
        });
      }

      return (data as AppointmentRecord | null) || null;
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
          message: 'Unable to verify existing review.',
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
          message: 'Unable to create review.',
          details: error.message,
        });
      }

      const review = data as ReviewRecord | null;

      if (!review?.id) {
        throw new AppError({
          status: 500,
          code: 'INVALID_REVIEW_RESPONSE',
          message: 'Review creation returned an invalid response.',
        });
      }

      return review;
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
      const [privateResult, legacyResult, publicResult] = await Promise.all([
        client
          .from('professional_profiles')
          .update({
            rating: averageRating,
            total_reviews: totalReviews,
          })
          .eq('id', professionalId),
        client
          .from('professionals')
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

      if (legacyResult.error) {
        throw new AppError({
          status: 500,
          code: 'LEGACY_REVIEW_METRICS_UPDATE_FAILED',
          message: 'Unable to update professional review metrics.',
          details: legacyResult.error.message,
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

export function createSubmitAppointmentReviewRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createSubmitAppointmentReviewRepository(client),
  };
}
