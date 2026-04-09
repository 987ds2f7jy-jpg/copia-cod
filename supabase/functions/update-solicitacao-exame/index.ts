import { handleUpdateSolicitacaoExameRequest } from './handler.ts';

export const updateSolicitacaoExameHandler = (req: Request) => handleUpdateSolicitacaoExameRequest(req);

Deno.serve(updateSolicitacaoExameHandler);
