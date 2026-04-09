import { handleCreateAppointmentRequest } from './handler.ts';

export const createAppointmentHandler = (req: Request) => handleCreateAppointmentRequest(req);

Deno.serve(createAppointmentHandler);
