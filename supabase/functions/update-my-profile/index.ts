import { handleUpdateMyProfileRequest } from './handler.ts';

export const updateMyProfileHandler = (req: Request) => handleUpdateMyProfileRequest(req);

Deno.serve(updateMyProfileHandler);
