import { handlePaymentsWebhookRequest } from './handler.ts';

export const paymentsWebhookHandler = (req: Request) => handlePaymentsWebhookRequest(req);

Deno.serve(paymentsWebhookHandler);
