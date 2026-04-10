import { handleRequestWithdrawalRequest } from './handler.ts';

export const requestWithdrawalHandler = (req: Request) => handleRequestWithdrawalRequest(req);

Deno.serve(requestWithdrawalHandler);

