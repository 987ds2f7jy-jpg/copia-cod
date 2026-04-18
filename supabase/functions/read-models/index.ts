import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  readJsonBody,
  successResponse,
} from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { AppError } from '../_shared/errors.ts';
import { findAppUserByAuthUserId, type AppUserRecord } from '../_shared/appUsers.ts';
import { createServiceRoleClient, type SupabaseClient } from '../_shared/supabase.ts';

const FUNCTION_NAME = 'read-models';
const CORS: CorsOptions = {
  allowedMethods: ['POST'],
};
const MAX_LIMIT = 500;
const ENTITY_TABLES: Record<string, string> = {
  Appointment: 'appointments',
  AvailabilitySlot: 'availability_slots',
  Consulta: 'consultas',
  ProfessionalProfile: 'professional_profiles',
  ProfessionalPublicProfile: 'professional_public_profiles',
  Question: 'questions',
  Queue: 'queues',
  Review: 'reviews',
  SolicitacaoExame: 'solicitacoes_exames',
};

type ReadModelsInput = {
  action: 'filter' | 'get' | 'list';
  entity: string;
  filters: Record<string, unknown>;
  orderBy: string;
  limit: number | null;
};

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeLimit(value: unknown) {
  const limit = Number(value || 0);

  if (!Number.isFinite(limit) || limit <= 0) {
    return null;
  }

  return Math.min(Math.trunc(limit), MAX_LIMIT);
}

function parseInput(body: unknown): ReadModelsInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const action = normalizeString(record.action || 'filter') as ReadModelsInput['action'];
  const entity = normalizeString(record.entity);
  const rawFilters = record.filters;

  if (action !== 'filter' && action !== 'get' && action !== 'list') {
    throw new AppError({
      status: 400,
      code: 'READ_ACTION_INVALID',
      message: '"action" must be filter, get or list.',
    });
  }

  if (!ENTITY_TABLES[entity]) {
    throw new AppError({
      status: 400,
      code: 'READ_ENTITY_INVALID',
      message: 'Requested read model is not allowed.',
    });
  }

  if (rawFilters && (typeof rawFilters !== 'object' || Array.isArray(rawFilters))) {
    throw new AppError({
      status: 400,
      code: 'READ_FILTERS_INVALID',
      message: '"filters" must be an object.',
    });
  }

  return {
    action,
    entity,
    filters: (rawFilters as Record<string, unknown>) || {},
    orderBy: normalizeString(record.orderBy),
    limit: normalizeLimit(record.limit),
  };
}

async function resolveOptionalAppUser(req: Request, client: SupabaseClient) {
  const authHeader = req.headers.get('Authorization') || '';

  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (!token || token === 'null' || token === 'undefined') {
    return null;
  }

  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user?.id) {
    return null;
  }

  return findAppUserByAuthUserId(client, data.user.id);
}

function requireAppUser(appUser: AppUserRecord | null): AppUserRecord {
  if (!appUser?.id) {
    throw new AppError({
      status: 401,
      code: 'AUTH_REQUIRED',
      message: 'Authentication is required for this read model.',
    });
  }

  if (appUser.isActive === false) {
    throw new AppError({
      status: 403,
      code: 'ACCOUNT_INACTIVE',
      message: 'Authenticated account is inactive.',
    });
  }

  return appUser;
}

async function listProfessionalContext(client: SupabaseClient, appUserId: string) {
  const { data, error } = await client
    .from('professional_profiles')
    .select('id, specialty')
    .eq('user_id', appUserId);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PROFESSIONAL_CONTEXT_LOOKUP_FAILED',
      message: 'Unable to resolve professional read context.',
      details: error.message,
    });
  }

  const rows = (data as Record<string, unknown>[] | null) || [];

  return {
    profileIds: rows.map((row) => normalizeString(row.id)).filter(Boolean),
    specialties: rows.map((row) => normalizeString(row.specialty)).filter(Boolean),
  };
}

function isPublicBookedAppointmentRead(filters: Record<string, unknown>) {
  const professionalId = normalizeString(filters.professional_id);
  const status = normalizeString(filters.status);

  return Boolean(professionalId && ['CONFIRMADO', 'confirmed', 'accepted', 'completed', 'CONCLUIDO'].includes(status));
}

async function assertReadAllowed(params: {
  client: SupabaseClient;
  entity: string;
  filters: Record<string, unknown>;
  appUser: AppUserRecord | null;
}) {
  const { client, entity, filters, appUser } = params;

  if (entity === 'ProfessionalPublicProfile' || entity === 'AvailabilitySlot') {
    return;
  }

  if (entity === 'Appointment' && isPublicBookedAppointmentRead(filters)) {
    return;
  }

  if (
    entity === 'Review' &&
    normalizeString(filters.professional_id) &&
    !normalizeString(filters.patient_id)
  ) {
    return;
  }

  if (entity === 'Question' && normalizeString(filters.status) === 'RESPONDIDA') {
    return;
  }

  if (
    entity === 'Queue' &&
    normalizeString(filters.status) === 'waiting' &&
    normalizeString(filters.specialty) &&
    !normalizeString(filters.patient_id)
  ) {
    return;
  }

  const authenticatedUser = requireAppUser(appUser);

  if (entity === 'Appointment') {
    if (normalizeString(filters.patient_id) === authenticatedUser.id) {
      return;
    }

    if (authenticatedUser.role === 'professional') {
      const context = await listProfessionalContext(client, authenticatedUser.id);
      const requestedProfessionalId = normalizeString(filters.professional_id);
      const requestedSpecialty = normalizeString(filters.specialty);
      const requestedStatus = normalizeString(filters.status);

      if (requestedProfessionalId && context.profileIds.includes(requestedProfessionalId)) {
        return;
      }

      if (
        requestedStatus === 'SOLICITADO' &&
        requestedSpecialty &&
        context.specialties.includes(requestedSpecialty)
      ) {
        return;
      }
    }
  }

  if (
    entity === 'Review' &&
    normalizeString(filters.patient_id) === authenticatedUser.id
  ) {
    return;
  }

  if (
    entity === 'Question' &&
    normalizeString(filters.paciente_id) === authenticatedUser.id
  ) {
    return;
  }

  if (
    entity === 'Queue' &&
    normalizeString(filters.patient_id) === authenticatedUser.id
  ) {
    return;
  }

  if (
    entity === 'Consulta' &&
    normalizeString(filters.paciente_id) === authenticatedUser.id
  ) {
    return;
  }

  if (
    entity === 'SolicitacaoExame' &&
    (normalizeString(filters.paciente_id) === authenticatedUser.id || authenticatedUser.role === 'professional')
  ) {
    return;
  }

  throw new AppError({
    status: 403,
    code: 'READ_FORBIDDEN',
    message: 'Authenticated user is not allowed to read this data.',
  });
}

function applyFilters(query: any, filters: Record<string, unknown>) {
  let nextQuery = query;

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    nextQuery = nextQuery.eq(key, value);
  }

  return nextQuery;
}

function applyOrder(query: any, orderBy: string) {
  if (!orderBy) {
    return query;
  }

  const descending = orderBy.startsWith('-');
  const column = descending ? orderBy.slice(1) : orderBy;

  if (!column) {
    return query;
  }

  return query.order(column, { ascending: !descending });
}

function enforceServerFilters(entity: string, filters: Record<string, unknown>) {
  if (entity === 'ProfessionalPublicProfile') {
    return {
      ...filters,
      status: 'approved',
    };
  }

  if (entity === 'Question' && normalizeString(filters.status) === 'RESPONDIDA') {
    return {
      ...filters,
      status: 'RESPONDIDA',
    };
  }

  if (
    entity === 'Queue' &&
    normalizeString(filters.status) === 'waiting' &&
    normalizeString(filters.specialty) &&
    !normalizeString(filters.patient_id)
  ) {
    return {
      ...filters,
      payment_status: 'paid',
    };
  }

  if (
    entity === 'Appointment' &&
    normalizeString(filters.status) === 'SOLICITADO' &&
    !normalizeString(filters.patient_id)
  ) {
    return {
      ...filters,
      payment_status: 'paid',
    };
  }

  return filters;
}

async function createSignedUploadUrl(client: SupabaseClient, value: unknown) {
  const path = normalizeString(value);

  if (!path || /^https?:\/\//i.test(path)) {
    return path;
  }

  const { data, error } = await client.storage
    .from('uploads')
    .createSignedUrl(path, 60 * 60);

  if (error || !data?.signedUrl) {
    return path;
  }

  return data.signedUrl;
}

async function decorateRecord(client: SupabaseClient, entity: string, record: Record<string, unknown>) {
  if (!record) {
    return record;
  }

  if (entity === 'ProfessionalPublicProfile' || entity === 'ProfessionalProfile') {
    const photoPath = normalizeString(record.photo_url);
    const nextRecord = {
      ...record,
      photo_path: photoPath,
      photo_url: await createSignedUploadUrl(client, record.photo_url),
    };
    const galleryUrls = Array.isArray(record.gallery_urls) ? record.gallery_urls : [];
    return {
      ...nextRecord,
      gallery_paths: galleryUrls,
      gallery_urls: await Promise.all(galleryUrls.map((url) => createSignedUploadUrl(client, url))),
    };
  }

  if (entity === 'SolicitacaoExame') {
    const arquivos = Array.isArray(record.arquivos) ? record.arquivos : [];
    const arquivosUrls = Array.isArray(record.arquivos_urls) ? record.arquivos_urls : [];
    return {
      ...record,
      arquivo_receita_url: await createSignedUploadUrl(client, record.arquivo_receita_url),
      arquivos: await Promise.all(arquivos.map((url) => createSignedUploadUrl(client, url))),
      arquivos_urls: await Promise.all(arquivosUrls.map((url) => createSignedUploadUrl(client, url))),
    };
  }

  return record;
}

function sanitizePublicRecords(entity: string, filters: Record<string, unknown>, records: Record<string, unknown>[]) {
  if (entity === 'Appointment' && isPublicBookedAppointmentRead(filters)) {
    return records.map((record) => ({
      id: record.id,
      professional_id: record.professional_id,
      scheduled_datetime: record.scheduled_datetime,
      date: record.date,
      time: record.time,
      status: record.status,
    }));
  }

  if (
    entity === 'Queue' &&
    normalizeString(filters.status) === 'waiting' &&
    normalizeString(filters.specialty) &&
    !normalizeString(filters.patient_id)
  ) {
    return records.map((record) => ({
      id: record.id,
      specialty: record.specialty,
      status: record.status,
      position: record.position,
      estimated_wait_time: record.estimated_wait_time,
      created_date: record.created_date,
    }));
  }

  return records;
}

async function readEntity({
  client,
  input,
  appUser,
}: {
  client: SupabaseClient;
  input: ReadModelsInput;
  appUser: AppUserRecord | null;
}) {
  await assertReadAllowed({
    client,
    entity: input.entity,
    filters: input.filters,
    appUser,
  });

  const tableName = ENTITY_TABLES[input.entity];
  const filters = enforceServerFilters(input.entity, input.filters);
  let query = client.from(tableName).select('*');
  query = applyFilters(query, filters);
  query = applyOrder(query, input.orderBy);

  if (input.action === 'get') {
    query = query.limit(1);
  } else if (input.limit) {
    query = query.limit(input.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError({
      status: 500,
      code: 'READ_MODEL_LOOKUP_FAILED',
      message: 'Unable to load read model data.',
      details: error.message,
    });
  }

  const rows = ((data as Record<string, unknown>[] | null) || []);
  const sanitizedRows = sanitizePublicRecords(input.entity, filters, rows);
  const records = await Promise.all(
    sanitizedRows.map((row) => decorateRecord(client, input.entity, row)),
  );

  return {
    records,
    record: input.action === 'get' ? records[0] || null : null,
  };
}

async function handleReadModelsRequest(req: Request) {
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
    const input = parseInput(await readJsonBody<unknown>(req));
    const client = createServiceRoleClient();
    const appUser = await resolveOptionalAppUser(req, client);
    const result = await readEntity({ client, input, appUser });

    return successResponse(result, requestId, {
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

Deno.serve(handleReadModelsRequest);
