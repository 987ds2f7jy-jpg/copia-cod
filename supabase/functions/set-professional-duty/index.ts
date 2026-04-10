import { handleSetProfessionalDutyRequest } from './handler.ts';

export const setProfessionalDutyHandler = (req: Request) => handleSetProfessionalDutyRequest(req);

Deno.serve(setProfessionalDutyHandler);

