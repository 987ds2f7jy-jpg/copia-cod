import { AppError } from '../_shared/errors.ts';
import type {
  GetSolicitacaoExameAtendimentoCommand,
  GetSolicitacaoExameAtendimentoRepository,
  GetSolicitacaoExameAtendimentoResult,
  SolicitacaoExameAtendimentoRecord,
} from './types.ts';

const DIRECT_SERVICE_TYPES = new Set(['checkup', 'renovacao_receitas']);

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function assertAccessibleSolicitacao(
  solicitacao: SolicitacaoExameAtendimentoRecord,
  professionalProfileIds: string[],
) {
  const medicoId = normalizeString(solicitacao.medico_id);

  if (!medicoId || !professionalProfileIds.includes(medicoId)) {
    throw new AppError({
      status: 404,
      code: 'SOLICITACAO_EXAME_NOT_FOUND',
      message: 'Exam/service request not found.',
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
      message: 'Exam/service request payment must be confirmed before attendance.',
    });
  }

  if (
    !DIRECT_SERVICE_TYPES.has(normalizeString(solicitacao.tipo)) ||
    normalizeString(solicitacao.fluxo_destino || 'dashboard') !== 'dashboard'
  ) {
    throw new AppError({
      status: 422,
      code: 'SOLICITACAO_EXAME_DIRECT_FLOW_UNSUPPORTED',
      message: 'This exam/service request cannot be attended in this screen.',
    });
  }
}

export async function getSolicitacaoExameAtendimento({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: GetSolicitacaoExameAtendimentoRepository;
} & GetSolicitacaoExameAtendimentoCommand): Promise<GetSolicitacaoExameAtendimentoResult> {
  const professionalIdentity = await repository.findProfessionalIdentityByAuthUserId(authenticatedUser.authUserId);

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

  assertAccessibleSolicitacao(solicitacao, professionalIdentity.profileIds);

  console.info('[get-solicitacao-exame-atendimento] request:success', {
    requestId,
    solicitacaoId: solicitacao.id,
    professionalProfileId: solicitacao.medico_id,
    tipo: solicitacao.tipo,
  });

  return {
    solicitacaoExame: solicitacao,
    patient: await repository.findPatientById(solicitacao.paciente_id),
  };
}
