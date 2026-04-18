import { handleSimulatePaymentPaidRequest } from './handler.ts';

export const simulatePaymentPaidHandler = (req: Request) => handleSimulatePaymentPaidRequest(req);

Deno.serve(simulatePaymentPaidHandler);
