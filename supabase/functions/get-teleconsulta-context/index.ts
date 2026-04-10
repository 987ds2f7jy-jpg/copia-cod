import { handleGetTeleconsultaContextRequest } from './handler.ts';

export const getTeleconsultaContextHandler = (req: Request) => handleGetTeleconsultaContextRequest(req);

Deno.serve(getTeleconsultaContextHandler);
