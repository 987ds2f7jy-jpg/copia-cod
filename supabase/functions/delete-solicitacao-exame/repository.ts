import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { findAppUserByAuthUserId } from '../_shared/appUsers.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  DeleteSolicitacaoExameRepository,
  SolicitacaoExameSummary,
} from './types.ts';

function createDeleteSolicitacaoExameRepository(client: SupabaseClient): DeleteSolicitacaoExameRepository {
  return {
    async findAppUserByAuthUserId(authUserId: string) {
      return findAppUserByAuthUserId(client, authUserId);
    },

    async findSolicitacaoExameById(solicitacaoId: string): Promise<SolicitacaoExameSummary | null> {
      const { data, error } = await client
        .from('solicitacoes_exames')
        .select('id, paciente_id, status')
        .eq('id', solicitacaoId)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'SOLICITACAO_EXAME_LOOKUP_FAILED',
          message: 'Unable to load exam request.',
          details: error.message,
        });
      }

      return (data as SolicitacaoExameSummary | null) || null;
    },

    async deleteSolicitacaoExame(solicitacaoId: string): Promise<void> {
      const { error } = await client
        .from('solicitacoes_exames')
        .delete()
        .eq('id', solicitacaoId);

      if (error) {
        throw new AppError({
          status: 500,
          code: 'SOLICITACAO_EXAME_DELETE_FAILED',
          message: 'Unable to delete exam request.',
          details: error.message,
        });
      }
    },
  };
}

export function createDeleteSolicitacaoExameRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createDeleteSolicitacaoExameRepository(client),
  };
}
