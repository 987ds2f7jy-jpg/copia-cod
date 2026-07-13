import { AppError, isAppError } from './errors.ts';
import type { AppRole } from './professional.ts';
import type { SupabaseClient } from './supabase.ts';

type LogLevel = 'info' | 'warn' | 'error';

export type TechnicalLogEvent = {
  functionName: string;
  requestId?: string | null;
  operation: string;
  actorId?: string | null;
  actorRole?: AppRole | 'system' | null;
  resourceType?: string | null;
  resourceId?: string | null;
  status?: string | null;
  errorCode?: string | null;
  durationMs?: number | null;
  provider?: string | null;
  retryCount?: number | null;
};

export type AuditEventInput = {
  environment?: string | null;
  actorUserId?: string | null;
  actorRole?: AppRole | 'system' | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome: 'started' | 'succeeded' | 'failed' | 'rejected' | 'resolved' | 'manual_review_required';
  errorCode?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
};

const AUDIT_METADATA_KEYS = new Set([
  'provider',
  'retry_count',
  'previous_status',
  'next_status',
  'issue_type',
  'reason_code',
  'external_status',
  'payment_charge_id',
  'plan_credit_usage_id',
  'owner_type',
]);

function normalizeString(value: unknown, maxLength = 160) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeEnvironment() {
  try {
    return normalizeString(Deno.env.get('APP_ENV') || 'unknown', 40) || 'unknown';
  } catch {
    return 'unknown';
  }
}

function normalizeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function sanitizeErrorCode(error: unknown) {
  if (isAppError(error)) {
    return normalizeString(error.code, 120) || 'APP_ERROR';
  }

  if (error && typeof error === 'object' && 'code' in error) {
    return normalizeString((error as { code?: unknown }).code, 120) || 'UNEXPECTED_ERROR';
  }

  return 'UNEXPECTED_ERROR';
}

export function sanitizeAuditMetadata(metadata: Record<string, unknown> = {}) {
  const result: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (!AUDIT_METADATA_KEYS.has(key)) continue;

    if (typeof value === 'boolean') {
      result[key] = value;
      continue;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      result[key] = value;
      continue;
    }

    const normalized = normalizeString(value);
    if (normalized) result[key] = normalized;
  }

  return result;
}

export function buildTechnicalLog(event: TechnicalLogEvent) {
  return {
    timestamp: new Date().toISOString(),
    environment: normalizeEnvironment(),
    function_name: normalizeString(event.functionName, 80),
    request_id: normalizeString(event.requestId, 120) || undefined,
    operation: normalizeString(event.operation, 120),
    actor_id: normalizeString(event.actorId, 80) || undefined,
    actor_role: normalizeString(event.actorRole, 30) || undefined,
    resource_type: normalizeString(event.resourceType, 60) || undefined,
    resource_id: normalizeString(event.resourceId, 80) || undefined,
    status: normalizeString(event.status, 80) || undefined,
    error_code: normalizeString(event.errorCode, 120) || undefined,
    duration_ms: normalizeNumber(event.durationMs),
    provider: normalizeString(event.provider, 40) || undefined,
    retry_count: normalizeNumber(event.retryCount),
  };
}

export function logTechnicalEvent(level: LogLevel, event: TechnicalLogEvent) {
  const payload = buildTechnicalLog(event);

  if (level === 'error') {
    console.error(payload);
  } else if (level === 'warn') {
    console.warn(payload);
  } else {
    console.info(payload);
  }
}

export async function insertAuditEvent(client: SupabaseClient, input: AuditEventInput) {
  const { error } = await client.from('system_audit_events').insert({
    environment: normalizeString(input.environment || normalizeEnvironment(), 40) || 'unknown',
    actor_user_id: input.actorUserId || null,
    actor_role: input.actorRole || null,
    action: normalizeString(input.action, 120),
    resource_type: normalizeString(input.resourceType, 60),
    resource_id: input.resourceId || null,
    outcome: input.outcome,
    error_code: normalizeString(input.errorCode, 120) || null,
    request_id: normalizeString(input.requestId, 120) || null,
    metadata: sanitizeAuditMetadata(input.metadata),
  });

  if (error) {
    throw new AppError({
      status: 500,
      code: 'AUDIT_EVENT_WRITE_FAILED',
      message: 'Unable to record the technical audit event.',
    });
  }
}

export async function recordAuditEvent(client: SupabaseClient, input: AuditEventInput) {
  try {
    await insertAuditEvent(client, input);
    return true;
  } catch (error) {
    logTechnicalEvent('error', {
      functionName: 'audit',
      requestId: input.requestId,
      operation: input.action,
      actorId: input.actorUserId,
      actorRole: input.actorRole,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      status: 'failed',
      errorCode: sanitizeErrorCode(error),
    });
    return false;
  }
}
