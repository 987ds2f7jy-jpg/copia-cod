import { handleReplaceAvailabilitySlotsRequest } from './handler.ts';

export const replaceAvailabilitySlotsHandler = (req: Request) =>
  handleReplaceAvailabilitySlotsRequest(req);

Deno.serve(replaceAvailabilitySlotsHandler);

