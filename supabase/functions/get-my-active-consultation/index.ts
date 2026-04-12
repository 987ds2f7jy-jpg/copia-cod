import { handleGetMyActiveConsultationRequest } from './handler.ts';

export const getMyActiveConsultationHandler = (req: Request) =>
  handleGetMyActiveConsultationRequest(req);

Deno.serve(getMyActiveConsultationHandler);
