import { handleDeleteQuestionRequest } from './handler.ts';

export const deleteQuestionHandler = (req: Request) => handleDeleteQuestionRequest(req);

Deno.serve(deleteQuestionHandler);
