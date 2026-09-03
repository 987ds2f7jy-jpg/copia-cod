import type { PendingProfessional } from '../types';
import { invokeBackofficeFunction } from './client';

export async function getPendingProfessionals() {
  return invokeBackofficeFunction<{ professionals: PendingProfessional[] }>('backoffice-pending-professionals', { limit: 100 });
}

export async function reviewPendingProfessional(input: { professionalProfileId: string; action: 'approve' | 'reject'; reason?: string }) {
  return invokeBackofficeFunction<{ professional: { professional_profile_id: string; status: string; is_verified: boolean } }>(
    'backoffice-review-professional',
    input,
  );
}
