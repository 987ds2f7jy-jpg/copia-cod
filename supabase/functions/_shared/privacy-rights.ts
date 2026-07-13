import { AppError } from './errors.ts';

export const PRIVACY_REQUEST_TYPES = [
  'access',
  'export',
  'correction',
  'account_deactivation',
  'deletion_or_anonymization',
  'consent_information',
] as const;

export const PRIVACY_REQUEST_STATUSES = [
  'submitted',
  'in_review',
  'awaiting_user',
  'approved',
  'partially_approved',
  'rejected',
  'completed',
  'canceled',
] as const;

export const PRIVACY_DECISION_CODES = [
  'full_deletion_possible',
  'partial_anonymization',
  'retention_required',
  'identity_verification_required',
  'active_relationship_block',
  'legal_or_regulatory_hold',
  'request_fulfilled',
  'insufficient_information',
  'duplicate_request',
  'out_of_scope',
  'manual_review_required',
] as const;

export type PrivacyRequestType = typeof PRIVACY_REQUEST_TYPES[number];
export type PrivacyRequestStatus = typeof PRIVACY_REQUEST_STATUSES[number];
export type PrivacyDecisionCode = typeof PRIVACY_DECISION_CODES[number];

export type PrivacyRequestRow = {
  id: string;
  requester_user_id: string;
  request_type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  description: string;
  assigned_admin_user_id: string | null;
  decision_code: PrivacyDecisionCode | null;
  decision_note: string | null;
  public_response: string | null;
  review_version: number;
  export_storage_path: string | null;
  export_expires_at: string | null;
  submitted_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export const OPEN_PRIVACY_STATUSES: PrivacyRequestStatus[] = [
  'submitted',
  'in_review',
  'awaiting_user',
  'approved',
  'partially_approved',
];

export function requireRecord(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  return body as Record<string, unknown>;
}

export function requirePrivacyRequestType(value: unknown): PrivacyRequestType {
  const normalized = String(value ?? '').trim() as PrivacyRequestType;
  if (!PRIVACY_REQUEST_TYPES.includes(normalized)) {
    throw new AppError({
      status: 422,
      code: 'PRIVACY_REQUEST_TYPE_INVALID',
      message: 'Privacy request type is not allowed.',
    });
  }
  return normalized;
}

export function requirePrivacyRequestStatus(value: unknown): PrivacyRequestStatus {
  const normalized = String(value ?? '').trim() as PrivacyRequestStatus;
  if (!PRIVACY_REQUEST_STATUSES.includes(normalized)) {
    throw new AppError({
      status: 422,
      code: 'PRIVACY_REQUEST_STATUS_INVALID',
      message: 'Privacy request status is not allowed.',
    });
  }
  return normalized;
}

export function optionalPrivacyDecisionCode(value: unknown): PrivacyDecisionCode | null {
  const normalized = String(value ?? '').trim() as PrivacyDecisionCode;
  if (!normalized) return null;
  if (!PRIVACY_DECISION_CODES.includes(normalized)) {
    throw new AppError({
      status: 422,
      code: 'PRIVACY_DECISION_CODE_INVALID',
      message: 'Privacy decision code is not allowed.',
    });
  }
  return normalized;
}

export function normalizeLimitedText(value: unknown, maxLength: number, field: string) {
  const normalized = String(value ?? '').trim().replace(/\u0000/g, '');
  if (normalized.length > maxLength) {
    throw new AppError({
      status: 422,
      code: 'PRIVACY_TEXT_TOO_LONG',
      message: `${field} exceeds the allowed length.`,
    });
  }
  return normalized;
}

export function requireIdempotencyKey(value: unknown) {
  const key = String(value ?? '').trim();
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(key)) {
    throw new AppError({
      status: 422,
      code: 'IDEMPOTENCY_KEY_INVALID',
      message: 'A valid idempotency key is required.',
    });
  }
  return key;
}

export async function createRequestFingerprint(type: PrivacyRequestType, description: string) {
  const bytes = new TextEncoder().encode(`${type}\n${description.trim().toLowerCase()}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((part) => part.toString(16).padStart(2, '0'))
    .join('');
}

export function mapSelfServicePrivacyRequest(row: PrivacyRequestRow) {
  return {
    id: row.id,
    type: row.request_type,
    status: row.status,
    description: row.description,
    decisionCode: row.decision_code,
    publicResponse: row.public_response,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
    reviewVersion: row.review_version,
    exportReady: Boolean(row.export_storage_path && row.status === 'completed'),
  };
}

export const ALLOWED_STATUS_TRANSITIONS: Record<PrivacyRequestStatus, PrivacyRequestStatus[]> = {
  submitted: ['in_review', 'awaiting_user', 'approved', 'partially_approved', 'rejected', 'canceled'],
  in_review: ['awaiting_user', 'approved', 'partially_approved', 'rejected', 'completed'],
  awaiting_user: ['in_review', 'canceled'],
  approved: ['completed'],
  partially_approved: ['completed'],
  rejected: [],
  completed: [],
  canceled: [],
};
