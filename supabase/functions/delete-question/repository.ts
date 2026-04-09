import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { findAppUserByAuthUserId } from '../_shared/appUsers.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  DeleteQuestionRepository,
  QuestionRecord,
} from './types.ts';

function createDeleteQuestionRepository(client: SupabaseClient): DeleteQuestionRepository {
  return {
    async findAppUserByAuthUserId(authUserId: string) {
      return findAppUserByAuthUserId(client, authUserId);
    },

    async findQuestionById(questionId: string): Promise<QuestionRecord | null> {
      const { data, error } = await client
        .from('questions')
        .select('id, paciente_id, status')
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

    async deleteQuestion(questionId: string): Promise<void> {
      const { error } = await client
        .from('questions')
        .delete()
        .eq('id', questionId);

      if (error) {
        throw new AppError({
          status: 500,
          code: 'QUESTION_DELETE_FAILED',
          message: 'Unable to delete question.',
          details: error.message,
        });
      }
    },
  };
}

export function createDeleteQuestionRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createDeleteQuestionRepository(client),
  };
}
