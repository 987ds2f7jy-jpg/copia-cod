import { handleSubmitConsultaEvaluationRequest } from './handler.ts';

export const submitConsultaEvaluationHandler = (req: Request) => handleSubmitConsultaEvaluationRequest(req);

Deno.serve(submitConsultaEvaluationHandler);
