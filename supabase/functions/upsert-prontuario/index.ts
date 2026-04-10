import { handleUpsertProntuarioRequest } from './handler.ts';

export const upsertProntuarioHandler = (req: Request) => handleUpsertProntuarioRequest(req);

Deno.serve(upsertProntuarioHandler);
