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
let optionalSolicitacaoFieldsSupported = null;

function getErrorMessage(error) {
  const message = error instanceof Error
    ? error.message
    : typeof error?.message === 'string'
      ? error.message
      : String(error ?? '');
  return message;
}

function hasMissingColumnError(error, columnName) {
  const message = getErrorMessage(error);
  return message.includes(columnName) && message.includes('column');
}

function hasTipoConstraintError(error) {
  const message = getErrorMessage(error);
  return (
    message.includes('solicitacoes_exames_tipo_check') ||
    (message.includes('check constraint') && message.includes('tipo'))
  );
}

function stripOptionalSolicitacaoFields(payload) {
  const nextPayload = { ...payload };

  OPTIONAL_COLUMNS.forEach((columnName) => {
    delete nextPayload[columnName];
  });

  return nextPayload;
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
  let nextPayload = optionalSolicitacaoFieldsSupported === false
    ? stripOptionalSolicitacaoFields(payload)
    : { ...payload };
  let retriedWithoutOptionalFields = optionalSolicitacaoFieldsSupported === false;

  while (true) {
    try {
      const result = await base44.entities.SolicitacaoExame.create(nextPayload);

      if (optionalSolicitacaoFieldsSupported === null) {
        optionalSolicitacaoFieldsSupported = true;
      }

      return result;
    } catch (error) {
      const missingOptionalColumn = OPTIONAL_COLUMNS.some((columnName) => hasMissingColumnError(error, columnName));

      if (missingOptionalColumn && !retriedWithoutOptionalFields) {
        optionalSolicitacaoFieldsSupported = false;
        retriedWithoutOptionalFields = true;
        nextPayload = stripOptionalSolicitacaoFields(payload);
        continue;
      }

      if (hasTipoConstraintError(error) && payload.tipo === 'renovacao_receitas') {
        throw new Error('O banco ainda nao aceita o tipo renovacao_receitas. Aplique a migration da tabela solicitacoes_exames.');
      }

      throw error;
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

export async function createPrescriptionRenewalRequest(user, {
  nomeMedicamento,
  dosagem,
  frequencia,
  arquivoReceitaUrl,
}) {
  const authenticatedUser = ensureAuthenticatedUser(user);

  return createSolicitacaoExameWithFallback({
    ...buildPacienteSnapshot(authenticatedUser),
    tipo: 'renovacao_receitas',
    exame_solicitado: '',
    motivo: '',
    sintomas: '',
    status: 'pending',
    assintomatico_confirmado: false,
    nome_medicamento: nomeMedicamento,
    dosagem,
    frequencia,
    arquivo_receita_url: arquivoReceitaUrl,
    fluxo_destino: 'dashboard',
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

  if (solicitacao.tipo === 'renovacao_receitas') {
    const targetSpecialty = normalizeConsultaAgoraSpecialty(solicitacao.especialidade_destino || CLINICO_GERAL);
    const targetFlow = solicitacao.fluxo_destino || 'dashboard';
    return targetFlow === 'dashboard' && targetSpecialty === CLINICO_GERAL && professionalSpecialty === CLINICO_GERAL;
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
