import { handleBootstrapAppUserRequest } from './handler.ts';

export const bootstrapAppUserHandler = (req: Request) => handleBootstrapAppUserRequest(req);

Deno.serve(bootstrapAppUserHandler);
