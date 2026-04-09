import { handleAcceptAppointmentRequest } from './handler.ts';

export const acceptAppointmentHandler = (req: Request) => handleAcceptAppointmentRequest(req);

Deno.serve(acceptAppointmentHandler);
