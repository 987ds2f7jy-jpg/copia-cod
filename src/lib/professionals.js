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
