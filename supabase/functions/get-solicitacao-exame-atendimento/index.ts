import { handleGetSolicitacaoExameAtendimentoRequest } from './handler.ts';

export const getSolicitacaoExameAtendimentoHandler = (req: Request) =>
  handleGetSolicitacaoExameAtendimentoRequest(req);

Deno.serve(getSolicitacaoExameAtendimentoHandler);
