import { AppError } from '../_shared/errors.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';
import type {
  DeleteSolicitacaoExameCommand,
  DeleteSolicitacaoExameRepository,
  DeleteSolicitacaoExameResult,
} from './types.ts';

function ensurePatientAppUser(appUser: {
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

  if (appUser.role === 'professional') {
    throw new AppError({
      status: 403,
      code: 'PATIENT_ROLE_REQUIRED',
      message: 'Professional accounts cannot delete patient exam requests.',
    });
  }

  return appUser as AppUserRecord;
}

export async function deleteSolicitacaoExame({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: DeleteSolicitacaoExameRepository;
} & DeleteSolicitacaoExameCommand): Promise<DeleteSolicitacaoExameResult> {
  const appUser = ensurePatientAppUser(
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

  if (existing.paciente_id !== appUser.id) {
    throw new AppError({
      status: 403,
      code: 'SOLICITACAO_EXAME_OWNERSHIP_REQUIRED',
      message: 'Exam request does not belong to the authenticated patient.',
    });
  }

  if (existing.status !== 'pending') {
    throw new AppError({
      status: 409,
      code: 'SOLICITACAO_EXAME_DELETE_FORBIDDEN',
      message: 'Only pending exam requests can be deleted.',
    });
  }

  console.info('[delete-solicitacao-exame] request:start', {
    requestId,
    solicitacaoExameId: existing.id,
    patientId: appUser.id,
  });

  await repository.deleteSolicitacaoExame(existing.id);

  console.info('[delete-solicitacao-exame] request:success', {
    requestId,
    solicitacaoExameId: existing.id,
    patientId: appUser.id,
  });

  return {
    deleted: true,
    solicitacaoExameId: existing.id,
  };
}
