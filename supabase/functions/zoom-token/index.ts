import { createClient } from 'npm:@supabase/supabase-js@2.56.0';
import type { SessionAccountRecord } from '../_shared/sessionAccount.ts';
import { toAppError } from '../_shared/errors.ts';
import {
  requireConsultationAccess,
  type ConsultationRecord,
} from '../_shared/teleconsultaAccess.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

function getEnv(name: string) {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getFirstEnv(...names: string[]) {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required environment variable: ${names.join(' or ')}`);
}

function toSafeString(value: unknown) {
  return String(value ?? '').trim();
}

function stripUnsafeCharacters(value: unknown, pattern = /[^a-zA-Z0-9_-]/g) {
  return toSafeString(value).replace(pattern, '');
}

function buildZoomSessionName(consulta: ConsultationRecord) {
  const explicitName = toSafeString(consulta.sala_id);

  if (explicitName) {
    return explicitName.slice(0, 200);
  }

  return `consulta-${consulta.id}`.slice(0, 200);
}

function buildZoomSessionKey(consulta: ConsultationRecord) {
  const explicitKey = stripUnsafeCharacters(consulta.token_sala);

  if (explicitKey) {
    return explicitKey.slice(0, 36);
  }

  return stripUnsafeCharacters(consulta.id, /[^a-zA-Z0-9]/g).slice(0, 36);
}

function buildZoomUserIdentity(userId: string, participantRole: 'patient' | 'professional') {
  const prefix = participantRole === 'professional' ? 'pr-' : 'pt-';
  return `${prefix}${stripUnsafeCharacters(userId, /[^a-zA-Z0-9]/g).slice(0, 32)}`.slice(0, 35);
}

function buildZoomDisplayName({
  appUser,
  consulta,
  participantRole,
  requestedName,
}: {
  appUser: SessionAccountRecord;
  consulta: ConsultationRecord;
  participantRole: 'patient' | 'professional';
  requestedName?: unknown;
}) {
  const preferredName = toSafeString(requestedName);

  if (preferredName) {
    return preferredName.slice(0, 64);
  }

  if (appUser.fullName) {
    return appUser.fullName.slice(0, 64);
  }

  const fallbackName = participantRole === 'professional'
    ? consulta.profissional_nome
    : consulta.paciente_nome;

  return toSafeString(fallbackName || 'Participante').slice(0, 64);
}

async function createZoomSignature(secret: string, payload: Record<string, unknown>) {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };

  const toBase64Url = (value: string | Uint8Array) => {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    let binary = '';

    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const message = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const encodedSignature = toBase64Url(new Uint8Array(signatureBuffer));

  return `${message}.${encodedSignature}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const supabaseUrl = getEnv('SUPABASE_URL');
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    const zoomSdkKey = getFirstEnv('ZOOM_VIDEO_SDK_KEY', 'ZOOM_SDK_KEY');
    const zoomSdkSecret = getFirstEnv('ZOOM_VIDEO_SDK_SECRET', 'ZOOM_SDK_SECRET');

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const body = await req.json().catch(() => null);
    const consultationId = toSafeString(body?.consultationId);
    const requestedRole = body?.participantRole || body?.role;

    if (!consultationId) {
      return jsonResponse({ error: 'consultationId is required.' }, 400);
    }

    const {
      appUser,
      consultation: consulta,
      participantRole,
    } = await requireConsultationAccess({
      req,
      consultationId,
      client: adminClient,
    });

    if (['finalizada', 'cancelada'].includes(consulta.status)) {
      return jsonResponse({ error: 'Consulta indisponivel para videochamada.' }, 409);
    }

    const normalizedRequestedRole = requestedRole === 'host'
      ? 'professional'
      : requestedRole === 'participant'
        ? 'patient'
        : requestedRole;

    if (
      normalizedRequestedRole &&
      normalizedRequestedRole !== participantRole &&
      String(normalizedRequestedRole) !== String(participantRole === 'professional' ? 1 : 0)
    ) {
      return jsonResponse({ error: 'Role mismatch for this consultation.' }, 403);
    }

    const sessionName = buildZoomSessionName(consulta);
    const sessionKey = buildZoomSessionKey(consulta);
    const userIdentity = buildZoomUserIdentity(appUser.id, participantRole);
    const userName = buildZoomDisplayName({
      appUser,
      consulta,
      participantRole,
      requestedName: body?.userName,
    });
    const roleType = participantRole === 'professional' ? 1 : 0;
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 60 * 60 * 2;

    const signature = await createZoomSignature(zoomSdkSecret, {
      app_key: zoomSdkKey,
      role_type: roleType,
      tpc: sessionName,
      version: 1,
      iat: issuedAt,
      exp: expiresAt,
      user_identity: userIdentity,
      session_key: sessionKey,
    });

    console.info('[zoom-token]', {
      consultationId,
      appUserId: appUser.id,
      participantRole,
      sessionName,
    });

    return jsonResponse({
      signature,
      sessionName,
      sessionKey,
      userIdentity,
      userName,
      roleType,
    });
  } catch (error) {
    const appError = toAppError(error);

    console.error('[zoom-token]', {
      code: appError.code,
      message: appError.message,
      details: appError.details,
    });

    return jsonResponse({
      error: {
        code: appError.code,
        message: appError.message,
        details: appError.details,
      },
    }, appError.status);
  }
});
