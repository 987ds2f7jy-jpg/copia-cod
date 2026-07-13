import { requireAuthenticatedUser } from '../_shared/auth.ts';
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
import { getLegalDocument } from '../_shared/legal-documents.ts';
import { requireAppUserByAuthUserId } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
} from '../_shared/supabase.ts';

const FUNCTION_NAME = 'record-legal-event';
const CORS: CorsOptions = { allowedMethods: ['POST'] };

type LegalEventBody = {
  documentKey?: unknown;
  eventType?: unknown;
  locale?: unknown;
};

function normalizeLocale(value: unknown) {
  const locale = String(value || 'pt-BR').trim();
  return /^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale) ? locale : 'pt-BR';
}

export async function handleRecordLegalEventRequest(req: Request) {
  const preflightResponse = handlePreflight(req, CORS);
  if (preflightResponse) return preflightResponse;

  const requestId = createRequestId();
  const methodError = ensureMethod(req, {
    allowedMethods: ['POST'],
    functionName: FUNCTION_NAME,
    requestId,
    cors: CORS,
  });
  if (methodError) return methodError;

  try {
    const client = createServiceRoleClient();
    const authUser = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
    const appUser = await requireAppUserByAuthUserId(client, authUser.authUserId);
    const body = await readJsonBody<LegalEventBody>(req);
    const documentKey = String(body.documentKey || '').trim();
    const eventType = String(body.eventType || '').trim();
    const document = getLegalDocument(documentKey);

    if (!document?.allowedEvent || eventType !== document.allowedEvent) {
      throw new AppError({
        status: 400,
        code: 'LEGAL_EVENT_NOT_ALLOWED',
        message: 'Document or event type is not allowed.',
      });
    }

    if (!(document.audiences as readonly string[]).includes(appUser.role)) {
      throw new AppError({
        status: 403,
        code: 'LEGAL_DOCUMENT_NOT_APPLICABLE',
        message: 'This legal document does not apply to the authenticated user.',
      });
    }

    const locale = normalizeLocale(body.locale);
    const { data, error } = await client
      .from('legal_user_events')
      .upsert({
        user_id: appUser.id,
        document_key: document.key,
        document_version: document.version,
        event_type: document.allowedEvent,
        source: 'account',
        locale,
      }, {
        onConflict: 'user_id,document_key,document_version,event_type',
        ignoreDuplicates: true,
      })
      .select('id, document_key, document_version, event_type, occurred_at')
      .maybeSingle();

    if (error) {
      throw new AppError({
        status: 500,
        code: 'LEGAL_EVENT_RECORD_FAILED',
        message: 'Unable to record legal event.',
      });
    }

    let event = data;

    if (!event) {
      const { data: existingEvent, error: lookupError } = await client
      .from('legal_user_events')
      .select('id, document_key, document_version, event_type, occurred_at')
      .eq('user_id', appUser.id)
      .eq('document_key', document.key)
      .eq('document_version', document.version)
      .eq('event_type', document.allowedEvent)
      .single();

      if (lookupError) {
        throw new AppError({
          status: 500,
          code: 'LEGAL_EVENT_LOOKUP_FAILED',
          message: 'Unable to confirm legal event.',
        });
      }

      event = existingEvent;
    }

    if (!event) {
      throw new AppError({
        status: 500,
        code: 'LEGAL_EVENT_RECORD_FAILED',
        message: 'Unable to confirm legal event.',
      });
    }

    return successResponse({
      id: event.id,
      documentKey: event.document_key,
      documentVersion: event.document_version,
      eventType: event.event_type,
      occurredAt: event.occurred_at,
    }, requestId, { cors: CORS });
  } catch (error) {
    return errorResponse(error, {
      requestId,
      functionName: FUNCTION_NAME,
      cors: CORS,
    });
  }
}

export const recordLegalEventHandler = (req: Request) => handleRecordLegalEventRequest(req);

Deno.serve(recordLegalEventHandler);
