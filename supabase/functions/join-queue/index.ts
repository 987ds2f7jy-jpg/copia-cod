import { handleJoinQueueRequest } from './handler.ts';

export const joinQueueHandler = (req: Request) => handleJoinQueueRequest(req);

Deno.serve(joinQueueHandler);
