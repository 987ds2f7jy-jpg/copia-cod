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
import { logTechnicalEvent, recordAuditEvent } from '../_shared/observability.ts';
import { createSessionAccountServiceClient } from '../_shared/sessionAccount.ts';
import { requireConsultationAccess } from '../_shared/teleconsultaAccess.ts';
import type {
  ConsultationConsentDecision,
  ConsultationConsentEventRow,
  ConsultationConsentKey,
} from '../_shared/consultation-consent.ts';

const FUNCTION_NAME = 'record-consultation-consent';
const CORS: CorsOptions = { allowedMethods: ['POST'] };
const CLOSED_STATUSES = new Set([
  'finalizada',
  'cancelada',
  'completed',
  'cancelled',
  'concluido',
  'cancelado',
]);

type Input = {
  consultationId: string;
  consentKey: ConsultationConsentKey;
  decision: ConsultationConsentDecision;
  idempotencyKey: string;
};

function parseInput(body: unknown): Input {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({ status: 400, code: 'INVALID_BODY', message: 'Request body must be an object.' });
  }

  const record = body as Record<string, unknown>;
  const consultationId = String(record.consultationId || '').trim();
  const consentKey = String(record.consentKey || '').trim() as ConsultationConsentKey;
  const decision = String(record.decision || '').trim() as ConsultationConsentDecision;
  const idempotencyKey = String(record.idempotencyKey || '').trim();
  const document = getLegalDocument(consentKey);
  const allowedEvents = document && 'allowedEvents' in document
    ? document.allowedEvents as readonly string[]
    : [];

  if (!consultationId) {
    throw new AppError({ status: 400, code: 'CONSULTATION_ID_REQUIRED', message: 'consultationId is required.' });
  }
  if (!document || !allowedEvents.includes(decision)) {
    throw new AppError({ status: 400, code: 'CONSULTATION_CONSENT_DECISION_INVALID', message: 'Consent key or decision is not allowed.' });
  }
  if (idempotencyKey.length < 8 || idempotencyKey.length > 120) {
    throw new AppError({ status: 400, code: 'IDEMPOTENCY_KEY_INVALID', message: 'A valid idempotencyKey is required.' });
  }

  return { consultationId, consentKey, decision, idempotencyKey };
}

function toDto(event: ConsultationConsentEventRow, skipped: boolean, reason: string | null) {
  return {
    id: event.id,
    consultationId: event.consulta_id,
    consentKey: event.consent_key,
    documentVersion: event.document_version,
    decision: event.decision,
    occurredAt: event.occurred_at,
    skipped,
    reason,
  };
}

async function findEvent(client: ReturnType<typeof createSessionAccountServiceClient>, params: {
  consultationId: string;
  patientUserId: string;
  idempotencyKey?: string;
  consentKey?: ConsultationConsentKey;
}) {
  let query = client
    .from('consultation_consent_events')
    .select('id, consulta_id, patient_user_id, consent_key, document_version, decision, occurred_at, source, idempotency_key, created_at')
    .eq('consulta_id', params.consultationId)
    .eq('patient_user_id', params.patientUserId);

  if (params.idempotencyKey) query = query.eq('idempotency_key', params.idempotencyKey);
  if (params.consentKey) query = query.eq('consent_key', params.consentKey);

  const { data, error } = await query
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError({ status: 500, code: 'CONSULTATION_CONSENT_LOOKUP_FAILED', message: 'Unable to load consultation consent event.' });
  }

  return (data as ConsultationConsentEventRow | null) || null;
}

export async function handleRecordConsultationConsentRequest(req: Request) {
  const preflight = handlePreflight(req, CORS);
  if (preflight) return preflight;

  const requestId = createRequestId();
  const methodError = ensureMethod(req, {
    allowedMethods: ['POST'], functionName: FUNCTION_NAME, requestId, cors: CORS,
  });
  if (methodError) return methodError;

  try {
    const input = parseInput(await readJsonBody<unknown>(req));
    const client = createSessionAccountServiceClient();
    const { appUser, consultation } = await requireConsultationAccess({
      req,
      consultationId: input.consultationId,
      client,
      allowedRoles: ['patient'],
    });

    if (appUser.role !== 'patient') {
      throw new AppError({
        status: 403,
        code: 'CONSULTATION_CONSENT_ROLE_FORBIDDEN',
        message: 'Only the patient can record this consultation decision.',
      });
    }

    if (CLOSED_STATUSES.has(String(consultation.status || '').toLowerCase())) {
      throw new AppError({ status: 409, code: 'CONSULTATION_CONSENT_WINDOW_CLOSED', message: 'This consultation no longer accepts consent decisions.' });
    }

    const document = getLegalDocument(input.consentKey);
    if (!document) {
      throw new AppError({ status: 500, code: 'CONSULTATION_CONSENT_CONFIG_INVALID', message: 'Consultation consent configuration is invalid.' });
    }

    const byIdempotencyKey = await findEvent(client, {
      consultationId: consultation.id,
      patientUserId: appUser.id,
      idempotencyKey: input.idempotencyKey,
    });
    if (byIdempotencyKey) {
      if (byIdempotencyKey.consent_key !== input.consentKey || byIdempotencyKey.decision !== input.decision) {
        throw new AppError({ status: 409, code: 'IDEMPOTENCY_KEY_REUSED', message: 'Idempotency key was already used for another decision.' });
      }
      return successResponse(toDto(byIdempotencyKey, true, 'idempotent_replay'), requestId, { cors: CORS });
    }

    const current = await findEvent(client, {
      consultationId: consultation.id,
      patientUserId: appUser.id,
      consentKey: input.consentKey,
    });
    if (current?.decision === input.decision && current.document_version === document.version) {
      return successResponse(toDto(current, true, 'already_current'), requestId, { cors: CORS });
    }

    const source = String(consultation.status || '').toLowerCase() === 'em_atendimento'
      ? 'teleconsulta_session'
      : 'teleconsulta_entry';
    const { data, error } = await client
      .from('consultation_consent_events')
      .insert({
        consulta_id: consultation.id,
        patient_user_id: appUser.id,
        consent_key: input.consentKey,
        document_version: document.version,
        decision: input.decision,
        source,
        idempotency_key: input.idempotencyKey,
      })
      .select('id, consulta_id, patient_user_id, consent_key, document_version, decision, occurred_at, source, idempotency_key, created_at')
      .single();

    if (error || !data) {
      if (error?.code === '23505') {
        const racedEvent = await findEvent(client, {
          consultationId: consultation.id,
          patientUserId: appUser.id,
          idempotencyKey: input.idempotencyKey,
        });
        if (racedEvent) return successResponse(toDto(racedEvent, true, 'idempotent_race'), requestId, { cors: CORS });
      }
      throw new AppError({ status: 500, code: 'CONSULTATION_CONSENT_RECORD_FAILED', message: 'Unable to record consultation consent decision.' });
    }

    await recordAuditEvent(client, {
      actorUserId: appUser.id,
      actorRole: 'patient',
      action: 'consultation_consent_recorded',
      resourceType: 'consulta',
      resourceId: consultation.id,
      outcome: 'succeeded',
      requestId,
      metadata: {
        consent_key: input.consentKey,
        decision: input.decision,
        document_version: document.version,
      },
    });
    logTechnicalEvent('info', {
      functionName: FUNCTION_NAME,
      requestId,
      operation: 'record_consent',
      actorId: appUser.id,
      actorRole: 'patient',
      resourceType: 'consulta',
      resourceId: consultation.id,
      status: input.decision,
    });

    return successResponse(toDto(data as ConsultationConsentEventRow, false, null), requestId, { cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}

Deno.serve(handleRecordConsultationConsentRequest);
