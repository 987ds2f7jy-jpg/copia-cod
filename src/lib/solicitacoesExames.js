import { base44 } from '@/api/base44Client';
import { canWorkOnDuty, normalizePlantaoSpecialty, normalizeSpecialty } from '@/lib/professionals';

const OPTIONAL_COLUMNS = [
  'fluxo_destino',
  'especialidade_destino',
  'paciente_email',
  'paciente_telefone',
];

const PLANTAO_STORAGE_KEY = 'rd.solicitacaoExames.plantao';
const CLINICO_GERAL = 'clinico_geral';

function hasMissingColumnError(error, columnName) {
  const message = error instanceof Error
    ? error.message
    : typeof error?.message === 'string'
      ? error.message
      : String(error ?? '');
  return message.includes(columnName) && message.includes('column');
}

function ensureAuthenticatedUser(user) {
  if (!user?.id) {
    throw new Error('E necessario estar logado para enviar a solicitacao.');
  }

  return user;
}

function buildPacienteSnapshot(user) {
  return {
    paciente_id: user.id,
    paciente_nome: user.full_name || user.email || 'Paciente',
    paciente_email: user.email || '',
    paciente_telefone: user.phone || '',
  };
}

async function createSolicitacaoExameWithFallback(payload) {
  let nextPayload = { ...payload };

  while (true) {
    try {
      return await base44.entities.SolicitacaoExame.create(nextPayload);
    } catch (error) {
      const missingColumn = OPTIONAL_COLUMNS.find((columnName) => hasMissingColumnError(error, columnName));

      if (!missingColumn) {
        throw error;
      }

      delete nextPayload[missingColumn];
    }
  }
}

export function buildSpecificExamSymptoms({ exame, motivo, sintomas }) {
  const parts = [
    exame ? `[Solicitacao de Exame: ${exame}]` : '',
    motivo ? `Motivo: ${motivo}` : '',
    sintomas ? `Sintomas: ${sintomas}` : '',
  ].filter(Boolean);

  return parts.join('. ');
}

export async function createCheckupRequest(user) {
  const authenticatedUser = ensureAuthenticatedUser(user);

  return createSolicitacaoExameWithFallback({
    ...buildPacienteSnapshot(authenticatedUser),
    tipo: 'checkup',
    exame_solicitado: 'Check-Up Completo',
    motivo: 'Exames de rotina / check-up preventivo',
    sintomas: '',
    status: 'pending',
    assintomatico_confirmado: true,
    fluxo_destino: 'dashboard',
    especialidade_destino: CLINICO_GERAL,
  });
}

export async function createSpecificExamRequest(user, { exame, motivo, sintomas }) {
  const authenticatedUser = ensureAuthenticatedUser(user);

  return createSolicitacaoExameWithFallback({
    ...buildPacienteSnapshot(authenticatedUser),
    tipo: 'especificos',
    exame_solicitado: exame,
    motivo: motivo || '',
    sintomas: sintomas || '',
    status: 'pending',
    assintomatico_confirmado: false,
    fluxo_destino: 'plantao',
    especialidade_destino: CLINICO_GERAL,
  });
}

export function persistSpecificExamRedirect(data) {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.setItem(PLANTAO_STORAGE_KEY, JSON.stringify(data));
}

export function readSpecificExamRedirect() {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedValue = sessionStorage.getItem(PLANTAO_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    return JSON.parse(storedValue);
  } catch {
    return null;
  }
}

export function clearSpecificExamRedirect() {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.removeItem(PLANTAO_STORAGE_KEY);
}

export function normalizeConsultaAgoraSpecialty(value) {
  const normalized = normalizePlantaoSpecialty(value);

  if (canWorkOnDuty(normalized)) {
    return normalized;
  }

  if (normalized === normalizeSpecialty('Clinico Geral')) {
    return CLINICO_GERAL;
  }

  return '';
}

export function shouldShowSolicitacaoForProfessional(solicitacao, professional) {
  if (!solicitacao || !professional?.specialty) {
    return false;
  }

  const professionalSpecialty = normalizePlantaoSpecialty(professional.specialty);

  if (solicitacao.tipo === 'checkup') {
    const targetSpecialty = normalizeConsultaAgoraSpecialty(solicitacao.especialidade_destino || CLINICO_GERAL);
    const targetFlow = solicitacao.fluxo_destino || 'dashboard';
    return targetFlow === 'dashboard' && targetSpecialty === CLINICO_GERAL && professionalSpecialty === CLINICO_GERAL;
  }

  if (solicitacao.tipo === 'especificos') {
    return false;
  }

  return true;
}

export async function listDirectSolicitacoesForProfessional(professional) {
  const professionalSpecialty = normalizePlantaoSpecialty(professional?.specialty);

  if (professionalSpecialty !== CLINICO_GERAL) {
    return [];
  }

  try {
    return await base44.entities.SolicitacaoExame.filter({
      status: 'pending',
      fluxo_destino: 'dashboard',
      especialidade_destino: CLINICO_GERAL,
    }, '-created_date');
  } catch (error) {
    const hasSchemaMismatch = OPTIONAL_COLUMNS.some((columnName) => hasMissingColumnError(error, columnName));

    if (!hasSchemaMismatch) {
      throw error;
    }

    const pendingSolicitacoes = await base44.entities.SolicitacaoExame.filter({ status: 'pending' }, '-created_date');
    return pendingSolicitacoes.filter((solicitacao) => shouldShowSolicitacaoForProfessional(solicitacao, professional));
  }
}
