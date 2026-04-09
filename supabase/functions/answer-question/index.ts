import { handleAnswerQuestionRequest } from './handler.ts';

export const answerQuestionHandler = (req: Request) => handleAnswerQuestionRequest(req);

Deno.serve(answerQuestionHandler);
