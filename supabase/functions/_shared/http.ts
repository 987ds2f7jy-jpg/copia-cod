import { AppError, isAppError, toAppError } from './errors.ts';
import type { ApiErrorResponse, ApiSuccess } from './types.ts';

const DEFAULT_ALLOWED_HEADERS = [
  'authorization',
  'x-client-info',
  'apikey',
  'content-type',
  'x-supabase-client-platform',
  'x-supabase-client-platform-version',
  'x-supabase-client-runtime',
  'x-supabase-client-runtime-version',
];

export type CorsOptions = {
  allowOrigin?: string;
  allowedHeaders?: string[];
  allowedMethods?: string[];
};

function uniqueValues(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function buildCorsHeaders(options: CorsOptions = {}) {
  const allowedMethods = uniqueValues([...(options.allowedMethods || ['POST']), 'OPTIONS']);
  const allowedHeaders = uniqueValues([
    ...DEFAULT_ALLOWED_HEADERS,
    ...(options.allowedHeaders || []),
  ]);

  return {
    'Access-Control-Allow-Origin': options.allowOrigin || '*',
    'Access-Control-Allow-Headers': allowedHeaders.join(', '),
    'Access-Control-Allow-Methods': allowedMethods.join(', '),
  };
}

export function createRequestId() {
  return crypto.randomUUID();
}

export function jsonResponse(
  body: unknown,
  {
    status = 200,
    cors,
  }: {
    status?: number;
    cors?: CorsOptions;
  } = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(cors),
      'Content-Type': 'application/json',
    },
  });
}

export function successResponse<TData>(
  data: TData,
  requestId: string,
  {
    status = 200,
    cors,
  }: {
    status?: number;
    cors?: CorsOptions;
  } = {},
) {
  const body: ApiSuccess<TData> = {
    data,
    meta: {
      requestId,
    },
  };

  return jsonResponse(body, { status, cors });
}

export function errorResponse(
  error: unknown,
  {
    requestId,
    functionName,
    cors,
  }: {
    requestId: string;
    functionName: string;
    cors?: CorsOptions;
  },
) {
  const appError = toAppError(error);

  if (isAppError(error)) {
    if (appError.status >= 500) {
      console.error(`[${functionName}] request:failed`, {
        requestId,
        code: appError.code,
        details: appError.details,
      });
    }
  } else {
    console.error(`[${functionName}] request:unhandled-error`, {
      requestId,
      error,
    });
  }

  const body: ApiErrorResponse = {
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details,
      requestId,
    },
  };

  return jsonResponse(body, {
    status: appError.status,
    cors,
  });
}

export function handlePreflight(req: Request, cors?: CorsOptions) {
  if (req.method !== 'OPTIONS') {
    return null;
  }

  return new Response('ok', {
    headers: buildCorsHeaders(cors),
  });
}

export function ensureMethod(
  req: Request,
  {
    allowedMethods,
    functionName,
    requestId,
    cors,
  }: {
    allowedMethods: string[];
    functionName: string;
    requestId: string;
    cors?: CorsOptions;
  },
) {
  if (allowedMethods.includes(req.method)) {
    return null;
  }

  return errorResponse(
    new AppError({
      status: 405,
      code: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed.',
      details: {
        allowedMethods,
      },
    }),
    {
      requestId,
      functionName,
      cors,
    },
  );
}

export async function readJsonBody<TBody>(req: Request): Promise<TBody> {
  try {
    return await req.json() as TBody;
  } catch {
    throw new AppError({
      status: 400,
      code: 'INVALID_JSON',
      message: 'Request body must be valid JSON.',
    });
  }
}
