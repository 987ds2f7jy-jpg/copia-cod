import { isApprovedProfessionalStatus } from '../_shared/domains/professionalStatus.ts';
import { AppError } from '../_shared/errors.ts';
import type {
  AcceptSolicitacaoExameCommand,
  AcceptSolicitacaoExameRepository,
  AcceptSolicitacaoExameResult,
} from './types.ts';

const DIRECT_SERVICE_TYPES = new Set(['checkup', 'renovacao_receitas']);
const DIRECT_FLOW = 'dashboard';
const CLINICO_GERAL = 'clinico_geral';
const SPECIALTY_ALIASES: Record<string, string> = {
  psicologia_clinica: 'psicologia',
};

function normalizeSpecialty(value: string | null | undefined) {
  const normalized = String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

  return SPECIALTY_ALIASES[normalized] || normalized;
}

function normalizeString(value: string | null | undefined) {
  return String(value || '').trim();
}

function isEmptyOwner(value: string | null | undefined) {
  return normalizeString(value) === '';
}

function assertDirectServiceRequest(solicitacao: {
  tipo: string | null;
  fluxo_destino: string | null;
  especialidade_destino: string | null;
}) {
  const tipo = normalizeString(solicitacao.tipo);
  const fluxoDestino = normalizeString(solicitacao.fluxo_destino || DIRECT_FLOW);
  const especialidadeDestino = normalizeSpecialty(solicitacao.especialidade_destino || CLINICO_GERAL);

  if (!DIRECT_SERVICE_TYPES.has(tipo) || fluxoDestino !== DIRECT_FLOW || especialidadeDestino !== CLINICO_GERAL) {
    throw new AppError({
      status: 422,
      code: 'SOLICITACAO_EXAME_DIRECT_FLOW_UNSUPPORTED',
      message: 'This exam/service request cannot be accepted from the professional dashboard.',
      details: {
        tipo,
        fluxoDestino,
        especialidadeDestino,
      },
    });
  }
}

function mapUnavailableSolicitacaoError(status: string, medicoId: string) {
  if (status === 'pending' && isEmptyOwner(medicoId)) {
    return new AppError({
      status: 409,
      code: 'SOLICITACAO_EXAME_ACCEPT_CONFLICT',
      message: 'Exam/service request could not be accepted because it changed during processing.',
    });
  }

  return new AppError({
    status: 409,
    code: 'SOLICITACAO_EXAME_ALREADY_ACCEPTED',
    message: 'Exam/service request was already accepted or is no longer available.',
    details: {
      status,
      medicoId,
    },
  });
}

export async function acceptSolicitacaoExame({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: AcceptSolicitacaoExameRepository;
} & AcceptSolicitacaoExameCommand): Promise<AcceptSolicitacaoExameResult> {
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
      message: 'Only professionals can accept exam/service requests.',
    });
  }

  const professional = await repository.findProfessionalProfileByAppUserId(appUser.id);

  if (!professional?.id) {
    throw new AppError({
      status: 403,
      code: 'PROFESSIONAL_PROFILE_NOT_FOUND',
      message: 'No professional profile was found for this user.',
    });
  }

  const publicOrPrivateStatus = professional.publicStatus || professional.status;

  if (!isApprovedProfessionalStatus(publicOrPrivateStatus)) {
    throw new AppError({
      status: 403,
      code: 'PROFESSIONAL_PROFILE_NOT_ELIGIBLE',
      message: 'Professional profile must be approved to accept exam/service requests.',
    });
  }

  if (normalizeSpecialty(professional.specialty) !== CLINICO_GERAL) {
    throw new AppError({
      status: 403,
      code: 'PROFESSIONAL_SPECIALTY_NOT_ELIGIBLE',
      message: 'Only Clinico Geral professionals can accept these direct service requests.',
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

  assertDirectServiceRequest(solicitacao);

  if (normalizeString(solicitacao.payment_status) !== 'paid') {
    throw new AppError({
      status: 422,
      code: 'SOLICITACAO_EXAME_PAYMENT_REQUIRED',
      message: 'Exam/service request payment must be confirmed before acceptance.',
    });
  }

  const status = normalizeString(solicitacao.status || 'pending');
  const medicoId = normalizeString(solicitacao.medico_id);

  if (status === 'in_progress' && medicoId === professional.id) {
    return {
      solicitacaoExame: solicitacao,
    };
  }

  if (status !== 'pending' || medicoId) {
    throw new AppError({
      status: 409,
      code: 'SOLICITACAO_EXAME_ALREADY_ACCEPTED',
      message: 'Exam/service request was already accepted or is no longer available.',
      details: {
        status,
        medicoId,
      },
    });
  }

  console.info('[accept-solicitacao-exame] request:start', {
    requestId,
    solicitacaoId: solicitacao.id,
    professionalProfileId: professional.id,
    tipo: solicitacao.tipo,
  });

  const accepted = await repository.acceptSolicitacaoExame({
    solicitacaoId: solicitacao.id,
    professionalProfileId: professional.id,
    acceptedAt: new Date().toISOString(),
    expectedMedicoId: solicitacao.medico_id === null ? null : medicoId,
  });

  if (!accepted?.id) {
    const latest = await repository.findSolicitacaoExameById(input.solicitacaoId);

    if (!latest?.id) {
      throw new AppError({
        status: 404,
        code: 'SOLICITACAO_EXAME_NOT_FOUND',
        message: 'Exam/service request not found.',
      });
    }

    throw mapUnavailableSolicitacaoError(
      normalizeString(latest.status || 'pending'),
      normalizeString(latest.medico_id),
    );
  }

  console.info('[accept-solicitacao-exame] request:success', {
    requestId,
    solicitacaoId: accepted.id,
    professionalProfileId: accepted.medico_id,
    status: accepted.status,
  });

  return {
    solicitacaoExame: accepted,
  };
}
