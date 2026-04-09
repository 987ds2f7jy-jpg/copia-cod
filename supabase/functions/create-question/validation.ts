import { AppError } from '../_shared/errors.ts';
import type { CreateQuestionInput } from './types.ts';

export function parseCreateQuestionInput(body: unknown): CreateQuestionInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const specialty = String(record.specialty ?? '').trim();
  const questionText = String(record.questionText ?? '').trim();

  if (!specialty) {
    throw new AppError({
      status: 422,
      code: 'QUESTION_SPECIALTY_REQUIRED',
      message: '"specialty" is required.',
    });
  }

  if (!questionText) {
    throw new AppError({
      status: 422,
      code: 'QUESTION_TEXT_REQUIRED',
      message: '"questionText" is required.',
    });
  }

  if (questionText.length > 2000) {
    throw new AppError({
      status: 422,
      code: 'QUESTION_TEXT_TOO_LONG',
      message: '"questionText" must be at most 2000 characters.',
    });
  }

  return {
    specialty,
    questionText,
  };
}
