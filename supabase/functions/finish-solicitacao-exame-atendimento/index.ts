import { handleFinishSolicitacaoExameAtendimentoRequest } from './handler.ts';

export const finishSolicitacaoExameAtendimentoHandler = (req: Request) =>
  handleFinishSolicitacaoExameAtendimentoRequest(req);

Deno.serve(finishSolicitacaoExameAtendimentoHandler);
