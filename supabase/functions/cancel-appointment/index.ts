import { handleCancelAppointmentRequest } from './handler.ts';

export const cancelAppointmentHandler = (req: Request) => handleCancelAppointmentRequest(req);

Deno.serve(cancelAppointmentHandler);
