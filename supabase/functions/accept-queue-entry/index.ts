import { handleAcceptQueueEntryRequest } from './handler.ts';

export const acceptQueueEntryHandler = (req: Request) => handleAcceptQueueEntryRequest(req);

Deno.serve(acceptQueueEntryHandler);
