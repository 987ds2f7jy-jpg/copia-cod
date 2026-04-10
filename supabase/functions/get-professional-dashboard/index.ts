import { handleGetProfessionalDashboardRequest } from './handler.ts';

export const getProfessionalDashboardHandler = (req: Request) => handleGetProfessionalDashboardRequest(req);

Deno.serve(getProfessionalDashboardHandler);

