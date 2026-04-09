import { AppError } from '../_shared/errors.ts';
import type {
  AnswerQuestionCommand,
  AnswerQuestionRepository,
  AnswerQuestionResult,
} from './types.ts';

function normalizeSpecialty(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function isApprovedStatus(status: string) {
  return status === 'active' || status === 'approved';
}

export async function answerQuestion({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: AnswerQuestionRepository;
} & AnswerQuestionCommand): Promise<AnswerQuestionResult> {
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
      message: 'Only professional accounts can answer forum questions.',
    });
  }

  const professional = await repository.findProfessionalContextByUserId(appUser.id);

  if (!professional?.professionalId) {
    throw new AppError({
      status: 404,
      code: 'PROFESSIONAL_PROFILE_NOT_FOUND',
      message: 'Professional profile not found for the authenticated user.',
    });
  }

  if (!isApprovedStatus(professional.status)) {
    throw new AppError({
      status: 403,
      code: 'PROFESSIONAL_PROFILE_NOT_APPROVED',
      message: 'Professional profile must be approved before answering forum questions.',
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

  if (String(question.status || '') === 'RESPONDIDA') {
    throw new AppError({
      status: 409,
      code: 'QUESTION_ALREADY_ANSWERED',
      message: 'This question has already been answered.',
    });
  }

  const normalizedQuestionSpecialty = normalizeSpecialty(String(question.specialty || ''));
  const normalizedProfessionalSpecialty = normalizeSpecialty(professional.specialty);

  if (
    normalizedQuestionSpecialty
    && normalizedQuestionSpecialty !== 'todas'
    && normalizedQuestionSpecialty !== normalizedProfessionalSpecialty
  ) {
    throw new AppError({
      status: 403,
      code: 'QUESTION_SPECIALTY_FORBIDDEN',
      message: 'Authenticated professional cannot answer a question from another specialty.',
    });
  }

  console.info('[answer-question] request:start', {
    requestId,
    questionId: question.id,
    professionalId: professional.professionalId,
  });

  const updatedQuestion = await repository.answerQuestion({
    questionId: question.id,
    professionalId: professional.professionalId,
    professionalName: professional.fullName || appUser.fullName || 'Especialista',
    publicProfileId: professional.publicProfileId,
    answerText: input.answerText,
  });

  console.info('[answer-question] request:success', {
    requestId,
    questionId: updatedQuestion.id,
    professionalId: professional.professionalId,
  });

  return {
    question: updatedQuestion,
  };
}
