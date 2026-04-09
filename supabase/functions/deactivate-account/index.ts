import { handleDeactivateAccountRequest } from './handler.ts';

export const deactivateAccountHandler = (req: Request) => handleDeactivateAccountRequest(req);

Deno.serve(deactivateAccountHandler);
