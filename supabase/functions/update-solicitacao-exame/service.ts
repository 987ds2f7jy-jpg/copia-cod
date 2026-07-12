import { AppError } from '../_shared/errors.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';
import type {
  UpdateSolicitacaoExameCommand,
  UpdateSolicitacaoExameRepository,
  UpdateSolicitacaoExameResult,
} from './types.ts';

function ensureAuthenticatedAppUser(appUser: {
  id: string;
  role: string;
  isActive: boolean;
} | null): AppUserRecord {
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

  return appUser as AppUserRecord;
}

export async function updateSolicitacaoExame({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: UpdateSolicitacaoExameRepository;
} & UpdateSolicitacaoExameCommand): Promise<UpdateSolicitacaoExameResult> {
  const appUser = ensureAuthenticatedAppUser(
    await repository.findAppUserByAuthUserId(authenticatedUser.authUserId),
  );

  const existing = await repository.findSolicitacaoExameById(input.solicitacaoId);

  if (!existing?.id) {
    throw new AppError({
      status: 404,
      code: 'SOLICITACAO_EXAME_NOT_FOUND',
      message: 'Exam request not found.',
    });
  }

  const wantsQueueLink = Boolean(input.queueId);
  const wantsWorkflowUpdate = Boolean(input.status || input.medicoId);

  if (wantsWorkflowUpdate) {
    throw new AppError({
      status: 403,
      code: 'SOLICITACAO_EXAME_WORKFLOW_ENDPOINT_REQUIRED',
      message: 'Workflow ownership and status must be changed through the dedicated accept or finish endpoint.',
    });
  } else {
    if (existing.paciente_id !== appUser.id) {
      throw new AppError({
        status: 403,
        code: 'SOLICITACAO_EXAME_OWNERSHIP_REQUIRED',
        message: 'Exam request does not belong to the authenticated patient.',
      });
    }
  }

  if (wantsQueueLink && existing.paciente_id !== appUser.id) {
    throw new AppError({
      status: 403,
      code: 'SOLICITACAO_EXAME_OWNERSHIP_REQUIRED',
      message: 'Queue linking is only allowed for the owner patient.',
    });
  }

  console.info('[update-solicitacao-exame] request:start', {
    requestId,
    solicitacaoExameId: existing.id,
    operatorAppUserId: appUser.id,
    queueId: input.queueId || null,
    status: input.status || null,
    medicoId: input.medicoId || null,
  });

  const solicitacaoExame = await repository.updateSolicitacaoExame({
    solicitacaoId: existing.id,
    queueId: input.queueId || undefined,
    status: input.status || undefined,
    medicoId: input.medicoId || undefined,
  });

  console.info('[update-solicitacao-exame] request:success', {
    requestId,
    solicitacaoExameId: solicitacaoExame.id,
    status: solicitacaoExame.status,
    queueId: solicitacaoExame.queue_id,
    medicoId: solicitacaoExame.medico_id,
  });

  return {
    solicitacaoExame,
  };
}
