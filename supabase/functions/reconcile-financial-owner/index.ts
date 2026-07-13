import { handleReconcileFinancialOwnerRequest } from './handler.ts';

export const reconcileFinancialOwnerHandler = (req: Request) => handleReconcileFinancialOwnerRequest(req);

Deno.serve(reconcileFinancialOwnerHandler);
