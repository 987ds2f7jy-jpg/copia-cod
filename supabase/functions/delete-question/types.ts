import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';

export type DeleteQuestionInput = {
  questionId: string;
};

export type QuestionRecord = {
  id: string;
  paciente_id: string | null;
  status: string | null;
};

export type DeleteQuestionResult = {
  questionId: string;
};

export type DeleteQuestionSuccessResponse = ApiSuccess<DeleteQuestionResult>;
export type ErrorResponse = ApiErrorResponse;

export type DeleteQuestionRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findQuestionById(questionId: string): Promise<QuestionRecord | null>;
  deleteQuestion(questionId: string): Promise<void>;
};

export type DeleteQuestionCommand = {
  requestId: string;
  input: DeleteQuestionInput;
  authenticatedUser: AuthenticatedUser;
};
