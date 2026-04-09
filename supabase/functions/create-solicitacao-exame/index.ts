import { handleCreateSolicitacaoExameRequest } from './handler.ts';

export const createSolicitacaoExameHandler = (req: Request) => handleCreateSolicitacaoExameRequest(req);

Deno.serve(createSolicitacaoExameHandler);
