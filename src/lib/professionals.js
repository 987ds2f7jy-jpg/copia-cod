import { base44 } from '@/api/base44Client';
import { env } from '@/config/env';

export const PLANTAO_ESPECIALIDADES = ['clinico_geral', 'pediatria', 'psicologia', 'psiquiatria'];

const SPECIALTY_ALIASES = {
  psicologia_clinica: 'psicologia',
};

export function normalizeSpecialty(value) {
  return (value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

export function normalizePlantaoSpecialty(value) {
  const normalized = normalizeSpecialty(value);
  return SPECIALTY_ALIASES[normalized] || normalized;
}

export function canWorkOnDuty(value) {
  return PLANTAO_ESPECIALIDADES.includes(normalizePlantaoSpecialty(value));
}

export function isProfessionalApprovedStatus(status) {
  return status === 'approved' || status === 'active';
}

export function mapAdminActionToStatuses(action) {
  if (action === 'approve') {
    return {
      publicStatus: 'approved',
      privateStatus: 'active',
      isOnDuty: false,
    };
  }

  if (action === 'suspend') {
    return {
      publicStatus: 'suspended',
      privateStatus: 'inactive',
      isOnDuty: false,
    };
  }

  return {
    publicStatus: 'rejected',
    privateStatus: 'inactive',
    isOnDuty: false,
  };
}

export async function setProfessionalPublicDuty(publicProfileId, isOnDuty) {
  if (!publicProfileId) {
    return null;
  }

  return base44.entities.ProfessionalPublicProfile.update(publicProfileId, {
    is_on_duty: Boolean(isOnDuty),
  });
}

export async function resetProfessionalDutyForUser(userId) {
  if (!userId) {
    return [];
  }

  const publicProfiles = await base44.entities.ProfessionalPublicProfile.filter({ user_id: userId });
  const activeProfiles = publicProfiles.filter((profile) => profile?.is_on_duty);

  if (activeProfiles.length === 0) {
    return [];
  }

  return Promise.all(
    activeProfiles.map((profile) => setProfessionalPublicDuty(profile.id, false)),
  );
}

export function sendKeepaliveDutyOff(publicProfileId) {
  if (!publicProfileId || typeof window === 'undefined') {
    return;
  }

  const endpoint = `${env.supabaseUrl}/rest/v1/professional_public_profiles?id=eq.${publicProfileId}`;

  void fetch(endpoint, {
    method: 'PATCH',
    keepalive: true,
    headers: {
      apikey: env.supabasePublishableKey,
      Authorization: `Bearer ${env.supabasePublishableKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      is_on_duty: false,
    }),
  }).catch(() => {});
}
