import { createClient } from 'npm:@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-legacy-session-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AppUser = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  auth_user_id?: string | null;
  token_expires_at?: string | null;
};

type Consulta = {
  id: string;
  paciente_id: string;
  paciente_nome?: string | null;
  profissional_id: string;
  profissional_user_id?: string | null;
  profissional_nome?: string | null;
  status: string;
  sala_id?: string | null;
  token_sala?: string | null;
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

function toSafeString(value: unknown) {
  return String(value ?? '').trim();
}

function stripUnsafeCharacters(value: unknown, pattern = /[^a-zA-Z0-9_-]/g) {
  return toSafeString(value).replace(pattern, '');
}

function buildZoomSessionName(consulta: Consulta) {
  const explicitName = toSafeString(consulta.sala_id);

  if (explicitName) {
    return explicitName.slice(0, 200);
  }

  return `consulta-${consulta.id}`.slice(0, 200);
}

function buildZoomSessionKey(consulta: Consulta) {
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
  appUser: AppUser;
  consulta: Consulta;
  participantRole: 'patient' | 'professional';
  requestedName?: unknown;
}) {
  const preferredName = toSafeString(requestedName);

  if (preferredName) {
    return preferredName.slice(0, 64);
  }

  if (appUser.full_name) {
    return appUser.full_name.slice(0, 64);
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

async function resolveAppUserFromSupabaseSession(req: Request, adminClient: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get('Authorization') || '';

  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const accessToken = authHeader.replace('Bearer ', '').trim();

  if (!accessToken || accessToken === 'null' || accessToken === 'undefined') {
    return null;
  }

  const { data, error } = await adminClient.auth.getUser(accessToken);

  if (error || !data?.user?.id) {
    return null;
  }

  const { data: appUser, error: appUserError } = await adminClient
    .from('app_users')
    .select('id, full_name, email, role, is_active, auth_user_id')
    .eq('auth_user_id', data.user.id)
    .maybeSingle();

  if (appUserError) {
    throw appUserError;
  }

  return appUser as AppUser | null;
}

async function resolveAppUserFromLegacySession(req: Request, adminClient: ReturnType<typeof createClient>) {
  const legacyToken = req.headers.get('x-legacy-session-token')?.trim();

  if (!legacyToken) {
    return null;
  }

  const { data, error } = await adminClient
    .from('app_users')
    .select('id, full_name, email, role, is_active, token_expires_at')
    .eq('session_token', legacyToken)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  if (data.token_expires_at && new Date(data.token_expires_at) <= new Date()) {
    return null;
  }

  return data as AppUser;
}

async function resolveAppUser(req: Request, adminClient: ReturnType<typeof createClient>) {
  const sessionUser = await resolveAppUserFromSupabaseSession(req, adminClient);
  const appUser = sessionUser || await resolveAppUserFromLegacySession(req, adminClient);

  if (!appUser || appUser.is_active === false) {
    return null;
  }

  return appUser;
}

async function fetchProfessionalParticipantIds(adminClient: ReturnType<typeof createClient>, appUserId: string) {
  const participantIds = new Set<string>([appUserId]);

  const [profilesResult, legacyProfilesResult] = await Promise.all([
    adminClient
      .from('professional_profiles')
      .select('id')
      .eq('user_id', appUserId)
      .limit(10),
    adminClient
      .from('professionals')
      .select('id')
      .eq('user_id', appUserId)
      .limit(10),
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  if (legacyProfilesResult.error) {
    throw legacyProfilesResult.error;
  }

  for (const row of profilesResult.data || []) {
    if (row?.id) {
      participantIds.add(row.id);
    }
  }

  for (const row of legacyProfilesResult.data || []) {
    if (row?.id) {
      participantIds.add(row.id);
    }
  }

  return participantIds;
}

function resolveParticipantRole(consulta: Consulta, appUser: AppUser, professionalIds: Set<string>) {
  if (consulta.paciente_id === appUser.id) {
    return 'patient' as const;
  }

  if (
    professionalIds.has(consulta.profissional_id) ||
    professionalIds.has(toSafeString(consulta.profissional_user_id)) ||
    consulta.profissional_user_id === appUser.id ||
    consulta.profissional_id === appUser.id
  ) {
    return 'professional' as const;
  }

  return null;
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
    const zoomSdkKey = getEnv('ZOOM_VIDEO_SDK_KEY');
    const zoomSdkSecret = getEnv('ZOOM_VIDEO_SDK_SECRET');

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const body = await req.json().catch(() => null);
    const consultationId = toSafeString(body?.consultationId);

    if (!consultationId) {
      return jsonResponse({ error: 'consultationId is required.' }, 400);
    }

    const appUser = await resolveAppUser(req, adminClient);

    if (!appUser) {
      return jsonResponse({ error: 'Unauthorized.' }, 401);
    }

    const { data: consulta, error: consultaError } = await adminClient
      .from('consultas')
      .select('id, paciente_id, paciente_nome, profissional_id, profissional_user_id, profissional_nome, status, sala_id, token_sala')
      .eq('id', consultationId)
      .maybeSingle();

    if (consultaError) {
      throw consultaError;
    }

    if (!consulta) {
      return jsonResponse({ error: 'Consulta nao encontrada.' }, 404);
    }

    if (['finalizada', 'cancelada'].includes(consulta.status)) {
      return jsonResponse({ error: 'Consulta indisponivel para videochamada.' }, 409);
    }

    const professionalIds = await fetchProfessionalParticipantIds(adminClient, appUser.id);
    const participantRole = resolveParticipantRole(consulta as Consulta, appUser, professionalIds);

    if (!participantRole) {
      return jsonResponse({ error: 'Forbidden.' }, 403);
    }

    const sessionName = buildZoomSessionName(consulta as Consulta);
    const sessionKey = buildZoomSessionKey(consulta as Consulta);
    const userIdentity = buildZoomUserIdentity(appUser.id, participantRole);
    const userName = buildZoomDisplayName({
      appUser,
      consulta: consulta as Consulta,
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
    console.error('[zoom-token]', error);
    return jsonResponse({ error: 'Nao foi possivel gerar a sessao da consulta.' }, 500);
  }
});
