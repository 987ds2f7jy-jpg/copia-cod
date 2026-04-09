import { handleDeleteSolicitacaoExameRequest } from './handler.ts';

export const deleteSolicitacaoExameHandler = (req: Request) => handleDeleteSolicitacaoExameRequest(req);

Deno.serve(deleteSolicitacaoExameHandler);
