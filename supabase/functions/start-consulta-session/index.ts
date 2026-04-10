import { handleStartConsultaSessionRequest } from './handler.ts';

export const startConsultaSessionHandler = (req: Request) => handleStartConsultaSessionRequest(req);

Deno.serve(startConsultaSessionHandler);
