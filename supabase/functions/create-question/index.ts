import { handleCreateQuestionRequest } from './handler.ts';

export const createQuestionHandler = (req: Request) => handleCreateQuestionRequest(req);

Deno.serve(createQuestionHandler);
