export function normalizeProfessionalStatus(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

export function isApprovedProfessionalStatus(value: string | null | undefined) {
  return normalizeProfessionalStatus(value) === 'approved';
}
