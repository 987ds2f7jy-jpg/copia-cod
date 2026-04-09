import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';

export type CreateQuestionInput = {
  specialty: string;
  questionText: string;
};

export type QuestionRecord = {
  id: string;
  paciente_id: string | null;
  paciente_nome: string | null;
  specialty: string | null;
  pergunta: string;
  resposta: string | null;
  status: string | null;
  answered_by_professional_id: string | null;
  answered_by_professional_name: string | null;
  answered_at: string | null;
  public_profile_id: string | null;
  created_date: string;
  updated_at: string;
};

export type CreateQuestionResult = {
  question: QuestionRecord;
};

export type CreateQuestionSuccessResponse = ApiSuccess<CreateQuestionResult>;
export type ErrorResponse = ApiErrorResponse;

export type CreateQuestionRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  createQuestion(params: {
    patientId: string;
    patientName: string;
    specialty: string;
    questionText: string;
  }): Promise<QuestionRecord>;
};

export type CreateQuestionCommand = {
  requestId: string;
  input: CreateQuestionInput;
  authenticatedUser: AuthenticatedUser;
};
