import { AppError } from '../_shared/errors.ts';
import type { AnswerQuestionInput } from './types.ts';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseAnswerQuestionInput(body: unknown): AnswerQuestionInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const questionId = String(record.questionId ?? '').trim();
  const answerText = String(record.answerText ?? '').trim();

  if (!UUID_REGEX.test(questionId)) {
    throw new AppError({
      status: 400,
      code: 'QUESTION_ID_INVALID',
      message: '"questionId" must be a valid UUID.',
    });
  }

  if (!answerText) {
    throw new AppError({
      status: 422,
      code: 'ANSWER_TEXT_REQUIRED',
      message: '"answerText" is required.',
    });
  }

  if (answerText.length > 5000) {
    throw new AppError({
      status: 422,
      code: 'ANSWER_TEXT_TOO_LONG',
      message: '"answerText" must be at most 5000 characters.',
    });
  }

  return {
    questionId,
    answerText,
  };
}
