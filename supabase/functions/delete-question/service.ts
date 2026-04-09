import { AppError } from '../_shared/errors.ts';
import type {
  DeleteQuestionCommand,
  DeleteQuestionRepository,
  DeleteQuestionResult,
} from './types.ts';

export async function deleteQuestion({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: DeleteQuestionRepository;
} & DeleteQuestionCommand): Promise<DeleteQuestionResult> {
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
      message: 'Professional accounts cannot delete forum questions as patients.',
    });
  }

  const question = await repository.findQuestionById(input.questionId);

  if (!question?.id) {
    throw new AppError({
      status: 404,
      code: 'QUESTION_NOT_FOUND',
      message: 'Question not found.',
    });
  }

  if (question.paciente_id !== appUser.id) {
    throw new AppError({
      status: 403,
      code: 'QUESTION_DELETE_FORBIDDEN',
      message: 'Authenticated user does not own this question.',
    });
  }

  if (String(question.status || '') !== 'PENDENTE') {
    throw new AppError({
      status: 409,
      code: 'QUESTION_DELETE_NOT_ALLOWED',
      message: 'Only pending questions can be deleted.',
    });
  }

  console.info('[delete-question] request:start', {
    requestId,
    questionId: question.id,
    patientId: appUser.id,
  });

  await repository.deleteQuestion(question.id);

  console.info('[delete-question] request:success', {
    requestId,
    questionId: question.id,
    patientId: appUser.id,
  });

  return {
    questionId: question.id,
  };
}
