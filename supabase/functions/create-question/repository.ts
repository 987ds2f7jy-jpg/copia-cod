import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { findAppUserByAuthUserId } from '../_shared/appUsers.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  CreateQuestionRepository,
  QuestionRecord,
} from './types.ts';

function createCreateQuestionRepository(client: SupabaseClient): CreateQuestionRepository {
  return {
    async findAppUserByAuthUserId(authUserId: string) {
      return findAppUserByAuthUserId(client, authUserId);
    },

    async createQuestion(params): Promise<QuestionRecord> {
      const { data, error } = await client
        .from('questions')
        .insert({
          paciente_id: params.patientId,
          paciente_nome: params.patientName,
          specialty: params.specialty,
          pergunta: params.questionText,
          status: 'PENDENTE',
        })
        .select(`
          id,
          paciente_id,
          paciente_nome,
          specialty,
          pergunta,
          resposta,
          status,
          answered_by_professional_id,
          answered_by_professional_name,
          answered_at,
          public_profile_id,
          created_date,
          updated_at
        `)
        .single();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'QUESTION_CREATE_FAILED',
          message: 'Unable to create question.',
          details: error.message,
        });
      }

      const question = data as QuestionRecord | null;

      if (!question?.id) {
        throw new AppError({
          status: 500,
          code: 'INVALID_QUESTION_RESPONSE',
          message: 'Question creation returned an invalid response.',
        });
      }

      return question;
    },
  };
}

export function createCreateQuestionRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createCreateQuestionRepository(client),
  };
}
