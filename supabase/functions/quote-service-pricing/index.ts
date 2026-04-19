import { requireAuthenticatedUser } from '../_shared/auth.ts';
import { findAppUserByAuthUserId } from '../_shared/appUsers.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  readJsonBody,
  successResponse,
} from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import {
  getOnDutyServiceCodeForSpecialty,
  getSolicitacaoExameServiceCode,
  PROFILE_PRIORITY_SERVICE_CODE,
  PROFILE_STANDARD_SERVICE_CODE,
  SPECIALTY_REQUEST_SERVICE_CODE,
} from '../_shared/pricing/service-codes.ts';
import { resolveServicePricing } from '../_shared/pricing/resolve-service-pricing.ts';
import type { ServiceCode } from '../_shared/pricing/types.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
} from '../_shared/supabase.ts';

const FUNCTION_NAME = 'quote-service-pricing';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};

type QuoteFlow =
  | 'appointment_profile'
  | 'appointment_specialty'
  | 'on_duty'
  | 'solicitacao_exame';

type QuoteInput = {
  flow: QuoteFlow;
  professionalProfileId: string | null;
  priority: boolean;
  specialty: string;
  tipo: string;
};

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function parseInput(body: unknown): QuoteInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const flow = normalizeString(record.flow) as QuoteFlow;

  if (!['appointment_profile', 'appointment_specialty', 'on_duty', 'solicitacao_exame'].includes(flow)) {
    throw new AppError({
      status: 400,
      code: 'QUOTE_FLOW_INVALID',
      message: 'Quote flow is invalid.',
      details: {
        allowedFlows: ['appointment_profile', 'appointment_specialty', 'on_duty', 'solicitacao_exame'],
      },
    });
  }

  return {
    flow,
    professionalProfileId: normalizeString(record.professionalProfileId || record.professional_profile_id) || null,
    priority: Boolean(record.priority),
    specialty: normalizeString(record.specialty),
    tipo: normalizeString(record.tipo),
  };
}

function resolveQuoteService(input: QuoteInput): {
  serviceCode: ServiceCode;
  professionalProfileId: string | null;
} {
  if (input.flow === 'appointment_profile') {
    if (!input.professionalProfileId) {
      throw new AppError({
        status: 400,
        code: 'PROFESSIONAL_PROFILE_REQUIRED',
        message: 'Professional profile is required for profile appointment pricing.',
      });
    }

    return {
      serviceCode: input.priority ? PROFILE_PRIORITY_SERVICE_CODE : PROFILE_STANDARD_SERVICE_CODE,
      professionalProfileId: input.professionalProfileId,
    };
  }

  if (input.flow === 'appointment_specialty') {
    return {
      serviceCode: SPECIALTY_REQUEST_SERVICE_CODE,
      professionalProfileId: null,
    };
  }

  if (input.flow === 'on_duty') {
    const serviceCode = getOnDutyServiceCodeForSpecialty(input.specialty);

    if (!serviceCode) {
      throw new AppError({
        status: 422,
        code: 'DUTY_SPECIALTY_NOT_PRICED',
        message: 'Selected on-duty specialty is not supported for pricing.',
        details: { specialty: input.specialty },
      });
    }

    return {
      serviceCode,
      professionalProfileId: null,
    };
  }

  const serviceCode = getSolicitacaoExameServiceCode(input.tipo);

  if (!serviceCode) {
    throw new AppError({
      status: 422,
      code: 'SOLICITACAO_EXAME_SERVICE_NOT_PRICED',
      message: 'Exam request type is not supported for pricing.',
      details: { tipo: input.tipo },
    });
  }

  return {
    serviceCode,
    professionalProfileId: null,
  };
}

export async function handleQuoteServicePricingRequest(req: Request) {
  const preflightResponse = handlePreflight(req, CORS);

  if (preflightResponse) {
    return preflightResponse;
  }

  const requestId = createRequestId();
  const methodErrorResponse = ensureMethod(req, {
    allowedMethods: ['POST'],
    functionName: FUNCTION_NAME,
    requestId,
    cors: CORS,
  });

  if (methodErrorResponse) {
    return methodErrorResponse;
  }

  try {
    const body = await readJsonBody<unknown>(req);
    const input = parseInput(body);
    const client = createServiceRoleClient();
    const authenticatedUser = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
    const appUser = await findAppUserByAuthUserId(client, authenticatedUser.authUserId);

    if (!appUser?.id) {
      throw new AppError({
        status: 403,
        code: 'APP_USER_NOT_FOUND',
        message: 'Authenticated user is not linked to app_users.',
      });
    }

    if (appUser.isActive === false) {
      throw new AppError({
        status: 403,
        code: 'ACCOUNT_INACTIVE',
        message: 'Authenticated account is inactive.',
      });
    }

    if (appUser.role === 'professional') {
      throw new AppError({
        status: 403,
        code: 'PATIENT_ROLE_REQUIRED',
        message: 'Professional accounts cannot quote patient services.',
      });
    }

    const service = resolveQuoteService(input);
    const pricing = await resolveServicePricing(client, service);

    return successResponse({
      pricing,
    }, requestId, {
      status: 200,
      cors: CORS,
    });
  } catch (error) {
    return errorResponse(error, {
      requestId,
      functionName: FUNCTION_NAME,
      cors: CORS,
    });
  }
}

export const quoteServicePricingHandler = (req: Request) => handleQuoteServicePricingRequest(req);

Deno.serve(quoteServicePricingHandler);
