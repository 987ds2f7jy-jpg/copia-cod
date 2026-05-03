import { AppError } from '../_shared/errors.ts';
import type {
  FinishSolicitacaoExameAtendimentoCommand,
  FinishSolicitacaoExameAtendimentoRepository,
  FinishSolicitacaoExameAtendimentoResult,
} from './types.ts';

const DIRECT_SERVICE_TYPES = new Set(['checkup', 'renovacao_receitas']);

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

export async function finishSolicitacaoExameAtendimento({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: FinishSolicitacaoExameAtendimentoRepository;
} & FinishSolicitacaoExameAtendimentoCommand): Promise<FinishSolicitacaoExameAtendimentoResult> {
  const appUser = await repository.findAppUserByAuthUserId(authenticatedUser.authUserId);

  if (!appUser?.id) {
    throw new AppError({
      status: 403,
      code: 'APP_USER_NOT_FOUND',
      message: 'Authenticated user is not linked to app_users.',
    });
  }

  if (appUser.isActive === false) {
    throw new AppError({
      status: 403,
      code: 'ACCOUNT_INACTIVE',
      message: 'Authenticated account is inactive.',
    });
  }

  if (appUser.role !== 'professional') {
    throw new AppError({
      status: 403,
      code: 'PROFESSIONAL_ROLE_REQUIRED',
      message: 'Only professionals can finish exam/service requests.',
    });
  }

  const professionalIdentity = await repository.findProfessionalIdentityByAppUserId(appUser.id);

  if (!professionalIdentity?.profileIds?.length) {
    throw new AppError({
      status: 403,
      code: 'PROFESSIONAL_PROFILE_NOT_FOUND',
      message: 'No professional profile was found for this user.',
    });
  }

  const solicitacao = await repository.findSolicitacaoExameById(input.solicitacaoId);

  if (!solicitacao?.id) {
    throw new AppError({
      status: 404,
      code: 'SOLICITACAO_EXAME_NOT_FOUND',
      message: 'Exam/service request not found.',
    });
  }

  const assignedProfessionalId = normalizeString(solicitacao.medico_id);

  if (!assignedProfessionalId || !professionalIdentity.profileIds.includes(assignedProfessionalId)) {
    throw new AppError({
      status: 404,
      code: 'SOLICITACAO_EXAME_NOT_FOUND',
      message: 'Exam/service request not found.',
    });
  }

  if (normalizeString(solicitacao.status) === 'completed') {
    throw new AppError({
      status: 409,
      code: 'SOLICITACAO_EXAME_ALREADY_COMPLETED',
      message: 'Exam/service request was already completed.',
    });
  }

  if (normalizeString(solicitacao.status) !== 'in_progress') {
    throw new AppError({
      status: 409,
      code: 'SOLICITACAO_EXAME_NOT_IN_PROGRESS',
      message: 'Exam/service request is not in attendance.',
    });
  }

  if (normalizeString(solicitacao.payment_status) !== 'paid') {
    throw new AppError({
      status: 422,
      code: 'SOLICITACAO_EXAME_PAYMENT_REQUIRED',
      message: 'Exam/service request payment must be confirmed before finishing.',
    });
  }

  if (
    !DIRECT_SERVICE_TYPES.has(normalizeString(solicitacao.tipo)) ||
    normalizeString(solicitacao.fluxo_destino || 'dashboard') !== 'dashboard'
  ) {
    throw new AppError({
      status: 422,
      code: 'SOLICITACAO_EXAME_DIRECT_FLOW_UNSUPPORTED',
      message: 'This exam/service request cannot be finished in this screen.',
    });
  }

  console.info('[finish-solicitacao-exame-atendimento] request:start', {
    requestId,
    solicitacaoId: solicitacao.id,
    professionalProfileId: assignedProfessionalId,
    tipo: solicitacao.tipo,
  });

  const result = await repository.finishSolicitacaoExameAtendimento({
    solicitacaoId: solicitacao.id,
    professionalProfileId: assignedProfessionalId,
    professionalAppUserId: appUser.id,
    recomendacoes: input.recomendacoes,
  });

  console.info('[finish-solicitacao-exame-atendimento] request:success', {
    requestId,
    solicitacaoId: result.result_solicitacao_id,
    consultaId: result.result_consulta_id,
    prontuarioId: result.result_prontuario_id,
  });

  return {
    solicitacaoExame: {
      id: result.result_solicitacao_id,
      status: result.result_status,
      consulta_id: result.result_consulta_id,
      completed_at: result.result_completed_at,
    },
    consulta: {
      id: result.result_consulta_id,
    },
    prontuario: {
      id: result.result_prontuario_id,
      consulta_id: result.result_consulta_id,
      recomendacoes: result.result_recomendacoes,
    },
  };
}
