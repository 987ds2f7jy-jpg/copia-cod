export function normalizeStatus(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

export function isApprovedStatus(value: string | null | undefined) {
  return normalizeStatus(value) === 'approved';
}

export function isActiveAccount(value: boolean | null | undefined) {
  return value !== false;
}
