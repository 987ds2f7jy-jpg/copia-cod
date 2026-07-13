import { handleGetReconciliationQueueRequest } from './handler.ts';

export const getReconciliationQueueHandler = (req: Request) => handleGetReconciliationQueueRequest(req);

Deno.serve(getReconciliationQueueHandler);
