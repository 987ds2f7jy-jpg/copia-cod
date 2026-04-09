import { handleSubmitAppointmentReviewRequest } from './handler.ts';

export const submitAppointmentReviewHandler = (req: Request) => handleSubmitAppointmentReviewRequest(req);

Deno.serve(submitAppointmentReviewHandler);
