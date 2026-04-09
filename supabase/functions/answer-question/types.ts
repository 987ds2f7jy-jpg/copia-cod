import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';
import type { AppUserRecord } from '../_shared/appUsers.ts';

export type AnswerQuestionInput = {
  questionId: string;
  answerText: string;
};

export type QuestionRecord = {
  id: string;
  paciente_id: string | null;
  specialty: string | null;
  status: string | null;
  pergunta: string;
  resposta: string | null;
  answered_by_professional_id: string | null;
  answered_by_professional_name: string | null;
  answered_at: string | null;
  public_profile_id: string | null;
  paciente_nome: string | null;
  created_date: string;
  updated_at: string;
};

export type ProfessionalContextRecord = {
  professionalId: string;
  fullName: string;
  specialty: string;
  status: string;
  publicProfileId: string | null;
  source: 'professional_profiles' | 'professionals';
};

export type AnswerQuestionResult = {
  question: QuestionRecord;
};

export type AnswerQuestionSuccessResponse = ApiSuccess<AnswerQuestionResult>;
export type ErrorResponse = ApiErrorResponse;

export type AnswerQuestionRepository = {
  findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null>;
  findProfessionalContextByUserId(userId: string): Promise<ProfessionalContextRecord | null>;
  findQuestionById(questionId: string): Promise<QuestionRecord | null>;
  answerQuestion(params: {
    questionId: string;
    professionalId: string;
    professionalName: string;
    publicProfileId: string | null;
    answerText: string;
  }): Promise<QuestionRecord>;
};

export type AnswerQuestionCommand = {
  requestId: string;
  input: AnswerQuestionInput;
  authenticatedUser: AuthenticatedUser;
};
