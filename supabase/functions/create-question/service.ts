import { AppError } from '../_shared/errors.ts';
import type {
  CreateQuestionCommand,
  CreateQuestionRepository,
  CreateQuestionResult,
} from './types.ts';

export async function createQuestion({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: CreateQuestionRepository;
} & CreateQuestionCommand): Promise<CreateQuestionResult> {
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
      message: 'Professional accounts cannot create forum questions as patients.',
    });
  }

  console.info('[create-question] request:start', {
    requestId,
    patientId: appUser.id,
    specialty: input.specialty,
  });

  const question = await repository.createQuestion({
    patientId: appUser.id,
    patientName: appUser.fullName || appUser.email || 'Paciente',
    specialty: input.specialty,
    questionText: input.questionText,
  });

  console.info('[create-question] request:success', {
    requestId,
    questionId: question.id,
    patientId: appUser.id,
  });

  return {
    question,
  };
}
