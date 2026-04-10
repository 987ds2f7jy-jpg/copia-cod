import { handleGetFinanceDashboardRequest } from './handler.ts';

export const getFinanceDashboardHandler = (req: Request) => handleGetFinanceDashboardRequest(req);

Deno.serve(getFinanceDashboardHandler);

