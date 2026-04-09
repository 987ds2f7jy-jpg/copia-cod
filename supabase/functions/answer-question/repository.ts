import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { findAppUserByAuthUserId } from '../_shared/appUsers.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  AnswerQuestionRepository,
  ProfessionalContextRecord,
  QuestionRecord,
} from './types.ts';

type ProfessionalRow = {
  id: string;
  full_name: string | null;
  specialty: string | null;
  status: string | null;
};

type PublicProfileRow = {
  id: string;
};

async function findPublicProfileId(
  client: SupabaseClient,
  professionalProfileId: string,
  userId: string,
) {
  const primaryLookup = await client
    .from('professional_public_profiles')
    .select('id')
    .eq('professional_profile_id', professionalProfileId)
    .limit(1);

  if (primaryLookup.error) {
    throw new AppError({
      status: 500,
      code: 'PUBLIC_PROFILE_LOOKUP_FAILED',
      message: 'Unable to load professional public profile.',
      details: primaryLookup.error.message,
    });
  }

  const primaryProfile = (primaryLookup.data as PublicProfileRow[] | null)?.[0];

  if (primaryProfile?.id) {
    return primaryProfile.id;
  }

  const fallbackLookup = await client
    .from('professional_public_profiles')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (fallbackLookup.error) {
    throw new AppError({
      status: 500,
      code: 'PUBLIC_PROFILE_LOOKUP_FAILED',
      message: 'Unable to load professional public profile.',
      details: fallbackLookup.error.message,
    });
  }

  return ((fallbackLookup.data as PublicProfileRow[] | null)?.[0]?.id) || null;
}

async function findProfessionalContext(
  client: SupabaseClient,
  userId: string,
): Promise<ProfessionalContextRecord | null> {
  const privateLookup = await client
    .from('professional_profiles')
    .select('id, full_name, specialty, status')
    .eq('user_id', userId)
    .order('created_date', { ascending: true })
    .limit(1);

  if (privateLookup.error) {
    throw new AppError({
      status: 500,
      code: 'PROFESSIONAL_PROFILE_LOOKUP_FAILED',
      message: 'Unable to load professional profile.',
      details: privateLookup.error.message,
    });
  }

  const privateProfile = (privateLookup.data as ProfessionalRow[] | null)?.[0];

  if (privateProfile?.id) {
    return {
      professionalId: privateProfile.id,
      fullName: privateProfile.full_name || '',
      specialty: privateProfile.specialty || '',
      status: privateProfile.status || '',
      publicProfileId: await findPublicProfileId(client, privateProfile.id, userId),
      source: 'professional_profiles',
    };
  }

  const legacyLookup = await client
    .from('professionals')
    .select('id, full_name, specialty, status')
    .eq('user_id', userId)
    .order('created_date', { ascending: true })
    .limit(1);

  if (legacyLookup.error) {
    throw new AppError({
      status: 500,
      code: 'LEGACY_PROFESSIONAL_LOOKUP_FAILED',
      message: 'Unable to load professional profile.',
      details: legacyLookup.error.message,
    });
  }

  const legacyProfessional = (legacyLookup.data as ProfessionalRow[] | null)?.[0];

  if (!legacyProfessional?.id) {
    return null;
  }

  return {
    professionalId: legacyProfessional.id,
    fullName: legacyProfessional.full_name || '',
    specialty: legacyProfessional.specialty || '',
    status: legacyProfessional.status || '',
    publicProfileId: await findPublicProfileId(client, legacyProfessional.id, userId),
    source: 'professionals',
  };
}

function createAnswerQuestionRepository(client: SupabaseClient): AnswerQuestionRepository {
  return {
    async findAppUserByAuthUserId(authUserId: string) {
      return findAppUserByAuthUserId(client, authUserId);
    },

    async findProfessionalContextByUserId(userId: string) {
      return findProfessionalContext(client, userId);
    },

    async findQuestionById(questionId: string): Promise<QuestionRecord | null> {
      const { data, error } = await client
        .from('questions')
        .select(`
          id,
          paciente_id,
          specialty,
          status,
          pergunta,
          resposta,
          answered_by_professional_id,
          answered_by_professional_name,
          answered_at,
          public_profile_id,
          paciente_nome,
          created_date,
          updated_at
        `)
        .eq('id', questionId)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'QUESTION_LOOKUP_FAILED',
          message: 'Unable to load question.',
          details: error.message,
        });
      }

      return (data as QuestionRecord | null) || null;
    },

    async answerQuestion(params): Promise<QuestionRecord> {
      const { data, error } = await client
        .from('questions')
        .update({
          resposta: params.answerText,
          answered_by_professional_id: params.professionalId,
          answered_by_professional_name: params.professionalName,
          answered_at: new Date().toISOString(),
          public_profile_id: params.publicProfileId || '',
          status: 'RESPONDIDA',
        })
        .eq('id', params.questionId)
        .select(`
          id,
          paciente_id,
          specialty,
          status,
          pergunta,
          resposta,
          answered_by_professional_id,
          answered_by_professional_name,
          answered_at,
          public_profile_id,
          paciente_nome,
          created_date,
          updated_at
        `)
        .single();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'QUESTION_ANSWER_FAILED',
          message: 'Unable to answer question.',
          details: error.message,
        });
      }

      const question = data as QuestionRecord | null;

      if (!question?.id) {
        throw new AppError({
          status: 500,
          code: 'INVALID_QUESTION_RESPONSE',
          message: 'Question answer returned an invalid response.',
        });
      }

      return question;
    },
  };
}

export function createAnswerQuestionRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createAnswerQuestionRepository(client),
  };
}
