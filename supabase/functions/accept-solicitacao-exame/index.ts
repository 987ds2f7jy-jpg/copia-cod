import { handleAcceptSolicitacaoExameRequest } from './handler.ts';

export const acceptSolicitacaoExameHandler = (req: Request) => handleAcceptSolicitacaoExameRequest(req);

Deno.serve(acceptSolicitacaoExameHandler);
