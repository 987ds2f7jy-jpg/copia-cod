import { AppError } from '../_shared/errors.ts';
import { createRequestId, errorResponse } from '../_shared/http.ts';
import { handlePaymentsWebhookRequest } from '../payments-webhook/handler.ts';

const FUNCTION_NAME = 'payments';

Deno.serve((req: Request) => {
  const url = new URL(req.url);

  if (url.pathname.endsWith('/payments/webhook') || url.pathname.endsWith('/webhook')) {
    return handlePaymentsWebhookRequest(req);
  }

  const requestId = createRequestId();

  return errorResponse(
    new AppError({
      status: 404,
      code: 'PAYMENTS_ROUTE_NOT_FOUND',
      message: 'Payments route was not found.',
      details: {
        path: url.pathname,
      },
    }),
    {
      requestId,
      functionName: FUNCTION_NAME,
    },
  );
});
