import { handleFinishConsultaRequest } from './handler.ts';

export const finishConsultaHandler = (req: Request) => handleFinishConsultaRequest(req);

Deno.serve(finishConsultaHandler);
