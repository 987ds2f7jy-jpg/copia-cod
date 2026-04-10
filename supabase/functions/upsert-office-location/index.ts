import { handleUpsertOfficeLocationRequest } from './handler.ts';

export const upsertOfficeLocationHandler = (req: Request) => handleUpsertOfficeLocationRequest(req);

Deno.serve(upsertOfficeLocationHandler);

