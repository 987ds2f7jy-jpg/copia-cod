import { handleUpsertProfessionalProfileRequest } from './handler.ts';

export const upsertProfessionalProfileHandler = (req: Request) =>
  handleUpsertProfessionalProfileRequest(req);

Deno.serve(upsertProfessionalProfileHandler);

