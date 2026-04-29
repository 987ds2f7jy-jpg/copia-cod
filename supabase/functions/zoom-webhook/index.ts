import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const FUNCTION_NAME = 'zoom-webhook';
const REPLAY_WINDOW_SECONDS = 5 * 60;
const ALLOWED_EVENTS = new Set([
  'session.user_joined',
  'session.user_left',
  'session.started',
  'session.ended',
]);

type SupabaseClient = ReturnType<typeof createClient>;

type ZoomWebhookBody = {
  event?: string;
  event_ts?: number | string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

type ZoomEventFields = {
  providerEventId: string;
  eventType: string;
  eventTs: string | null;
  sessionName: string;
  sessionKey: string;
  zoomSessionId: string;
  zoomUserId: string;
  zoomUserKey: string;
  zoomUserName: string;
  zoomLeaveReason: string;
};

type WebhookEventRow = {
  id: string;
  processed_at: string | null;
  consulta_id: string | null;
  appointment_id: string | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-zm-request-timestamp, x-zm-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function createServiceRoleClient() {
  return createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function toStringValue(value: unknown) {
  return String(value ?? '').trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readNestedRecord(record: Record<string, unknown>, path: string[]) {
  let current: unknown = record;

  for (const key of path) {
    const next = asRecord(current)[key];

    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      return {};
    }

    current = next;
  }

  return asRecord(current);
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = toStringValue(value);

    if (normalized) {
      return normalized;
    }
  }

  return '';
}

async function hmacSha256Hex(secret: string, message: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(left: string, right: string) {
  const a = left.toLowerCase();
  const b = right.toLowerCase();

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
}

function parseJsonBody(rawBody: string): ZoomWebhookBody {
  try {
    return rawBody ? JSON.parse(rawBody) as ZoomWebhookBody : {};
  } catch {
    throw Object.assign(new Error('Webhook body must be valid JSON.'), {
      status: 400,
      code: 'INVALID_JSON',
    });
  }
}

function normalizeTimestampSeconds(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  if (parsed > 1_000_000_000_000) {
    return Math.floor(parsed / 1000);
  }

  if (parsed > 10_000_000_000) {
    return Math.floor(parsed / 1000);
  }

  return Math.floor(parsed);
}

function parseEventTimestamp(value: unknown) {
  const stringValue = toStringValue(value);

  if (!stringValue) {
    return null;
  }

  const numeric = Number(stringValue);
  const timestamp = Number.isFinite(numeric)
    ? (numeric > 10_000_000_000 ? numeric : numeric * 1000)
    : Date.parse(stringValue);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

async function verifyZoomSignature({
  req,
  rawBody,
  secret,
}: {
  req: Request;
  rawBody: string;
  secret: string;
}) {
  const timestampHeader = req.headers.get('x-zm-request-timestamp') || '';
  const signatureHeader = req.headers.get('x-zm-signature') || '';
  const timestampSeconds = normalizeTimestampSeconds(timestampHeader);

  if (!timestampSeconds || !signatureHeader) {
    throw Object.assign(new Error('Zoom webhook signature headers are required.'), {
      status: 401,
      code: 'ZOOM_SIGNATURE_HEADERS_REQUIRED',
    });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > REPLAY_WINDOW_SECONDS) {
    throw Object.assign(new Error('Zoom webhook timestamp is outside the allowed replay window.'), {
      status: 401,
      code: 'ZOOM_SIGNATURE_TIMESTAMP_INVALID',
    });
  }

  const message = `v0:${timestampHeader}:${rawBody}`;
  const expectedSignature = `v0=${await hmacSha256Hex(secret, message)}`;

  if (!timingSafeEqual(expectedSignature, signatureHeader)) {
    throw Object.assign(new Error('Zoom webhook signature is invalid.'), {
      status: 401,
      code: 'ZOOM_SIGNATURE_INVALID',
    });
  }
}

async function handleUrlValidation(body: ZoomWebhookBody, secret: string) {
  const plainToken = firstString(
    readNestedRecord(body, ['payload']).plainToken,
    readNestedRecord(body, ['payload']).plain_token,
  );

  if (!plainToken) {
    return jsonResponse({
      error: {
        code: 'ZOOM_URL_VALIDATION_TOKEN_MISSING',
        message: 'Zoom URL validation plainToken is missing.',
      },
    }, 400);
  }

  return jsonResponse({
    plainToken,
    encryptedToken: await hmacSha256Hex(secret, plainToken),
  });
}

function extractZoomEventFields(body: ZoomWebhookBody): ZoomEventFields {
  const payload = asRecord(body.payload);
  const object = asRecord(payload.object);
  const participant = asRecord(
    object.participant || object.user || object.user_info || payload.participant || payload.user,
  );
  const eventType = firstString(body.event);
  const eventTs = parseEventTimestamp(body.event_ts || payload.event_ts || object.event_ts || object.start_time || object.end_time);
  const sessionName = firstString(
    object.session_name,
    object.sessionName,
    object.topic,
    payload.session_name,
  );
  const sessionKey = firstString(
    object.session_key,
    object.sessionKey,
    payload.session_key,
  );
  const zoomSessionId = firstString(
    object.session_id,
    object.sessionId,
    object.id,
    object.uuid,
    payload.session_id,
  );
  const zoomUserId = firstString(
    participant.user_id,
    participant.userId,
    participant.id,
    object.user_id,
    object.userId,
  );
  const zoomUserKey = firstString(
    participant.user_key,
    participant.userKey,
    participant.user_identity,
    participant.userIdentity,
    object.user_key,
    object.userKey,
    object.user_identity,
  );
  const zoomUserName = firstString(
    participant.user_name,
    participant.userName,
    participant.name,
    participant.display_name,
    object.user_name,
    object.userName,
  );
  const zoomLeaveReason = firstString(
    participant.leave_reason,
    participant.leaveReason,
    object.leave_reason,
    object.leaveReason,
    object.reason,
  );
  const providerEventId = firstString(
    body.event_id,
    body.id,
    payload.event_id,
    payload.id,
  );

  return {
    providerEventId,
    eventType,
    eventTs,
    sessionName,
    sessionKey,
    zoomSessionId,
    zoomUserId,
    zoomUserKey,
    zoomUserName,
    zoomLeaveReason,
  };
}

async function findExistingEvent({
  client,
  eventHash,
  providerEventId,
}: {
  client: SupabaseClient;
  eventHash: string;
  providerEventId: string;
}) {
  const { data: byHash, error: hashError } = await client
    .from('zoom_webhook_events')
    .select('id, processed_at, consulta_id, appointment_id')
    .eq('event_hash', eventHash)
    .maybeSingle();

  if (hashError) {
    throw Object.assign(new Error(hashError.message), {
      status: 500,
      code: 'ZOOM_WEBHOOK_EVENT_LOOKUP_FAILED',
    });
  }

  if (byHash?.id) {
    return byHash as WebhookEventRow;
  }

  if (!providerEventId) {
    return null;
  }

  const { data: byProviderEventId, error: providerError } = await client
    .from('zoom_webhook_events')
    .select('id, processed_at, consulta_id, appointment_id')
    .eq('provider_event_id', providerEventId)
    .maybeSingle();

  if (providerError) {
    throw Object.assign(new Error(providerError.message), {
      status: 500,
      code: 'ZOOM_WEBHOOK_EVENT_LOOKUP_FAILED',
    });
  }

  return (byProviderEventId as WebhookEventRow | null) || null;
}

async function createOrLoadEvent({
  client,
  eventHash,
  fields,
  payload,
}: {
  client: SupabaseClient;
  eventHash: string;
  fields: ZoomEventFields;
  payload: Record<string, unknown>;
}) {
  const existing = await findExistingEvent({
    client,
    eventHash,
    providerEventId: fields.providerEventId,
  });

  if (existing?.id) {
    return {
      row: existing,
      duplicate: Boolean(existing.processed_at),
    };
  }

  const { data, error } = await client
    .from('zoom_webhook_events')
    .insert({
      event_hash: eventHash,
      provider_event_id: fields.providerEventId,
      event_type: fields.eventType,
      event_ts: fields.eventTs,
      session_name: fields.sessionName,
      session_key: fields.sessionKey,
      zoom_session_id: fields.zoomSessionId,
      zoom_user_id: fields.zoomUserId,
      zoom_user_key: fields.zoomUserKey,
      zoom_user_name: fields.zoomUserName,
      zoom_leave_reason: fields.zoomLeaveReason,
      payload,
    })
    .select('id, processed_at, consulta_id, appointment_id')
    .single();

  if (error) {
    const loadedAfterConflict = await findExistingEvent({
      client,
      eventHash,
      providerEventId: fields.providerEventId,
    });

    if (loadedAfterConflict?.id) {
      return {
        row: loadedAfterConflict,
        duplicate: Boolean(loadedAfterConflict.processed_at),
      };
    }

    throw Object.assign(new Error(error.message), {
      status: 500,
      code: 'ZOOM_WEBHOOK_EVENT_CREATE_FAILED',
    });
  }

  return {
    row: data as WebhookEventRow,
    duplicate: false,
  };
}

function extractConsultationIdFromSessionName(sessionName: string) {
  const match = sessionName.match(/^consulta-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  return match?.[1] || '';
}

async function findConsultationId({
  client,
  sessionName,
  sessionKey,
}: {
  client: SupabaseClient;
  sessionName: string;
  sessionKey: string;
}) {
  if (sessionName) {
    const { data, error } = await client
      .from('consultas')
      .select('id')
      .eq('sala_id', sessionName)
      .maybeSingle();

    if (error) {
      throw Object.assign(new Error(error.message), {
        status: 500,
        code: 'ZOOM_CONSULTATION_LOOKUP_FAILED',
      });
    }

    if (data?.id) {
      return String(data.id);
    }
  }

  if (sessionKey) {
    const { data, error } = await client
      .from('consultas')
      .select('id')
      .eq('token_sala', sessionKey)
      .maybeSingle();

    if (error) {
      throw Object.assign(new Error(error.message), {
        status: 500,
        code: 'ZOOM_CONSULTATION_LOOKUP_FAILED',
      });
    }

    if (data?.id) {
      return String(data.id);
    }
  }

  const fallbackConsultationId = extractConsultationIdFromSessionName(sessionName);
  if (!fallbackConsultationId) {
    return '';
  }

  const { data, error } = await client
    .from('consultas')
    .select('id')
    .eq('id', fallbackConsultationId)
    .maybeSingle();

  if (error) {
    throw Object.assign(new Error(error.message), {
      status: 500,
      code: 'ZOOM_CONSULTATION_LOOKUP_FAILED',
    });
  }

  return data?.id ? String(data.id) : '';
}

async function findAppointmentId(client: SupabaseClient, consultationId: string) {
  if (!consultationId) {
    return '';
  }

  const { data, error } = await client
    .from('appointments')
    .select('id')
    .eq('consulta_id', consultationId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) {
    throw Object.assign(new Error(error.message), {
      status: 500,
      code: 'ZOOM_APPOINTMENT_LOOKUP_FAILED',
    });
  }

  return data?.[0]?.id ? String(data[0].id) : '';
}

async function markEventProcessed({
  client,
  eventId,
  consultationId,
  appointmentId,
  processingError,
}: {
  client: SupabaseClient;
  eventId: string;
  consultationId: string;
  appointmentId: string;
  processingError: string;
}) {
  const { error } = await client
    .from('zoom_webhook_events')
    .update({
      consulta_id: consultationId || null,
      appointment_id: appointmentId || null,
      processed_at: new Date().toISOString(),
      processing_error: processingError,
    })
    .eq('id', eventId);

  if (error) {
    throw Object.assign(new Error(error.message), {
      status: 500,
      code: 'ZOOM_WEBHOOK_EVENT_UPDATE_FAILED',
    });
  }
}

function buildStoredPayload(req: Request, body: ZoomWebhookBody) {
  return {
    body,
    headers: {
      xZmRequestTimestamp: req.headers.get('x-zm-request-timestamp') || '',
      xZmSignaturePresent: Boolean(req.headers.get('x-zm-signature')),
      userAgent: req.headers.get('user-agent') || '',
    },
  };
}

function errorResponse(error: unknown) {
  const status = Number((error as { status?: number })?.status || 500);
  const code = toStringValue((error as { code?: string })?.code) || 'ZOOM_WEBHOOK_ERROR';
  const message = error instanceof Error ? error.message : 'Unexpected Zoom webhook error.';

  if (status >= 500) {
    console.error(`[${FUNCTION_NAME}] request:failed`, {
      code,
      message,
    });
  } else {
    console.warn(`[${FUNCTION_NAME}] request:rejected`, {
      code,
      message,
    });
  }

  return jsonResponse({
    error: {
      code,
      message,
    },
  }, status);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Method not allowed.',
      },
    }, 405);
  }

  try {
    const secret = getRequiredEnv('ZOOM_WEBHOOK_SECRET_TOKEN');
    const rawBody = await req.text();
    const body = parseJsonBody(rawBody);
    const eventType = firstString(body.event);

    if (eventType === 'endpoint.url_validation') {
      return await handleUrlValidation(body, secret);
    }

    await verifyZoomSignature({ req, rawBody, secret });

    if (!ALLOWED_EVENTS.has(eventType)) {
      return jsonResponse({
        received: true,
        ignored: true,
        eventType,
      });
    }

    const client = createServiceRoleClient();
    const fields = extractZoomEventFields(body);
    const eventHash = await sha256Hex(rawBody);
    const event = await createOrLoadEvent({
      client,
      eventHash,
      fields,
      payload: buildStoredPayload(req, body),
    });

    if (event.duplicate) {
      return jsonResponse({
        received: true,
        duplicate: true,
        processed: true,
        webhookEventId: event.row.id,
        consultaId: event.row.consulta_id,
        appointmentId: event.row.appointment_id,
      });
    }

    let consultationId = '';
    let appointmentId = '';
    let processingError = '';

    try {
      consultationId = await findConsultationId({
        client,
        sessionName: fields.sessionName,
        sessionKey: fields.sessionKey,
      });

      if (!consultationId) {
        processingError = 'CONSULTA_NOT_RESOLVED';
      } else {
        appointmentId = await findAppointmentId(client, consultationId);
      }
    } catch (processingFailure) {
      processingError = toStringValue(
        (processingFailure as { code?: string })?.code ||
        (processingFailure instanceof Error ? processingFailure.message : processingFailure),
      ) || 'ZOOM_EVENT_PROCESSING_FAILED';
    }

    await markEventProcessed({
      client,
      eventId: event.row.id,
      consultationId,
      appointmentId,
      processingError,
    });

    console.info(`[${FUNCTION_NAME}] event:processed`, {
      eventType,
      sessionName: fields.sessionName,
      consultationId: consultationId || null,
      appointmentId: appointmentId || null,
      processingError,
    });

    return jsonResponse({
      received: true,
      duplicate: false,
      processed: true,
      webhookEventId: event.row.id,
      consultaId: consultationId || null,
      appointmentId: appointmentId || null,
      processingError,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
