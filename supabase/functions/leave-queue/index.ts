import { handleLeaveQueueRequest } from './handler.ts';

export const leaveQueueHandler = (req: Request) => handleLeaveQueueRequest(req);

Deno.serve(leaveQueueHandler);
