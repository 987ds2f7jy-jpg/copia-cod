import { AppError } from '../_shared/errors.ts';
import type {
  LeaveQueueCommand,
  LeaveQueueRepository,
  LeaveQueueResult,
} from './types.ts';

function toResult(queueEntry: {
  id: string;
  status: string | null;
  specialty: string | null;
  position: number | null;
  estimated_wait_time: number | null;
  assigned_professional_id: string | null;
  solicitacao_exame_id: string | null;
} | null): LeaveQueueResult['queueEntry'] {
  if (!queueEntry?.id) {
    return null;
  }

  return {
    id: queueEntry.id,
    status: queueEntry.status || '',
    specialty: queueEntry.specialty || '',
    position: Number(queueEntry.position || 0),
    estimatedWaitTime: Number(queueEntry.estimated_wait_time || 0),
    assignedProfessionalId: queueEntry.assigned_professional_id || '',
    solicitacaoExameId: queueEntry.solicitacao_exame_id || '',
  };
}

export async function leaveQueue({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: LeaveQueueRepository;
} & LeaveQueueCommand): Promise<LeaveQueueResult> {
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

  if (appUser.role === 'professional') {
    throw new AppError({
      status: 403,
      code: 'PATIENT_ROLE_REQUIRED',
      message: 'Professional accounts cannot leave the patient queue.',
    });
  }

  const activeEntry = await repository.findActiveQueueEntry({
    patientId: appUser.id,
    queueId: input.queueId,
  });

  if (!activeEntry?.id) {
    return {
      left: false,
      queueEntry: null,
    };
  }

  console.info('[leave-queue] request:start', {
    requestId,
    patientId: appUser.id,
    queueId: activeEntry.id,
  });

  const cancelledEntry = await repository.cancelQueueEntry(activeEntry.id);

  console.info('[leave-queue] request:success', {
    requestId,
    patientId: appUser.id,
    queueId: cancelledEntry.id,
    status: cancelledEntry.status,
  });

  return {
    left: true,
    queueEntry: toResult(cancelledEntry),
  };
}
