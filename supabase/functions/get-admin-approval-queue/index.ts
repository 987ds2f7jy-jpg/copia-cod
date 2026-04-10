import { handleGetAdminApprovalQueueRequest } from './handler.ts';

export const getAdminApprovalQueueHandler = (req: Request) => handleGetAdminApprovalQueueRequest(req);

Deno.serve(getAdminApprovalQueueHandler);

