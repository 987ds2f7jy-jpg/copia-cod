import { handleRegisterProfessionalRequest } from './handler.ts';

export const registerProfessionalHandler = (req: Request) => handleRegisterProfessionalRequest(req);

Deno.serve(registerProfessionalHandler);
