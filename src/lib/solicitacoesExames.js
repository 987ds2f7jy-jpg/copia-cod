import { base44 } from '@/api/base44Client';
import { canWorkOnDuty, normalizePlantaoSpecialty, normalizeSpecialty } from '@/lib/professionals';

const OPTIONAL_COLUMNS = [
  'fluxo_destino',
  'especialidade_destino',
  'paciente_email',
  'paciente_telefone',
  'dados_identificacao',
  'informacoes_saude',
  'arquivos',
  'queue_id',
];

const PLANTAO_STORAGE_KEY = 'rd.solicitacaoExames.plantao';
const LAUDO_WIZARD_STORAGE_KEY = 'rd.laudosMedicos.wizard';
const CLINICO_GERAL = 'clinico_geral';
let optionalSolicitacaoFieldsSupported = null;
const OPTIONAL_QUEUE_COLUMNS = ['solicitacao_exame_id'];
let optionalQueueFieldsSupported = null;
const MAX_UPLOAD_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

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

function stripOptionalQueueFields(payload) {
  const nextPayload = { ...payload };

  OPTIONAL_QUEUE_COLUMNS.forEach((columnName) => {
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

function getFileExtension(fileName = '') {
  return fileName.includes('.') ? `.${fileName.split('.').pop().toLowerCase()}` : '';
}

function isAllowedUploadByExtension(fileName = '') {
  const extension = getFileExtension(fileName);
  return ['.pdf', '.jpg', '.jpeg', '.png'].includes(extension);
}

export function validateMedicalSupportFile(file, { required = false } = {}) {
  if (!file) {
    return required ? 'Envie um arquivo obrigatorio.' : null;
  }

  if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
    return `O arquivo ${file.name} excede o limite de 10MB.`;
  }

  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type) && !isAllowedUploadByExtension(file.name)) {
    return `O arquivo ${file.name} tem um formato invalido. Use PDF, JPG ou PNG.`;
  }

  return null;
}

export function validateMedicalSupportFiles(files = [], { required = false, maxCount = 5 } = {}) {
  if ((!files || files.length === 0) && required) {
    return 'Envie ao menos um arquivo.';
  }

  if (files.length > maxCount) {
    return `Voce pode enviar no maximo ${maxCount} arquivos por categoria.`;
  }

  for (const file of files) {
    const error = validateMedicalSupportFile(file);
    if (error) {
      return error;
    }
  }

  return null;
}

export function persistLaudoWizardState(data) {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.setItem(LAUDO_WIZARD_STORAGE_KEY, JSON.stringify(data));
}

export function readLaudoWizardState() {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedValue = sessionStorage.getItem(LAUDO_WIZARD_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    return JSON.parse(storedValue);
  } catch {
    return null;
  }
}

export function clearLaudoWizardState() {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.removeItem(LAUDO_WIZARD_STORAGE_KEY);
}

function buildLaudoQueueSymptoms({ tipoLaudo, diagnostico, finalidade }) {
  return [
    tipoLaudo ? `[Laudo Medico: ${tipoLaudo}]` : '',
    diagnostico ? `Diagnostico: ${diagnostico}` : '',
    finalidade ? `Finalidade: ${finalidade}` : '',
  ].filter(Boolean).join('. ');
}

export async function createQueueEntryWithFallback(payload) {
  let nextPayload = optionalQueueFieldsSupported === false
    ? stripOptionalQueueFields(payload)
    : { ...payload };
  let retriedWithoutOptionalFields = optionalQueueFieldsSupported === false;

  while (true) {
    try {
      const result = await base44.entities.Queue.create(nextPayload);

      if (optionalQueueFieldsSupported === null) {
        optionalQueueFieldsSupported = true;
      }

      return result;
    } catch (error) {
      const missingOptionalColumn = OPTIONAL_QUEUE_COLUMNS.some((columnName) => hasMissingColumnError(error, columnName));

      if (missingOptionalColumn && !retriedWithoutOptionalFields) {
        optionalQueueFieldsSupported = false;
        retriedWithoutOptionalFields = true;
        nextPayload = stripOptionalQueueFields(payload);
        continue;
      }

      throw error;
    }
  }
}

export async function findCurrentQueueEntry(patientId, specialty = CLINICO_GERAL) {
  if (!patientId) {
    return null;
  }

  const statuses = ['waiting', 'in_progress', 'em_atendimento'];
  const matches = await Promise.all(
    statuses.map((status) => base44.entities.Queue.filter({ patient_id: patientId, specialty, status }, '-created_date', 5)),
  );

  return matches.flat()[0] || null;
}

export async function createLaudoQueueEntry({
  patientId,
  patientName,
  patientEmail,
  tipoLaudo,
  diagnostico,
  finalidade,
  solicitacaoExameId,
}) {
  const existingEntry = await findCurrentQueueEntry(patientId, CLINICO_GERAL);

  if (existingEntry) {
    return {
      entry: existingEntry,
      reusedExisting: true,
    };
  }

  const createdEntry = await createQueueEntryWithFallback({
    patient_id: patientId,
    patient_name: patientName,
    patient_email: patientEmail || '',
    specialty: CLINICO_GERAL,
    symptoms: buildLaudoQueueSymptoms({ tipoLaudo, diagnostico, finalidade }),
    priority_level: 'normal',
    status: 'waiting',
    solicitacao_exame_id: solicitacaoExameId || '',
  });

  return {
    entry: createdEntry,
    reusedExisting: false,
  };
}

export async function createLaudoMedicoRequest(user, {
  dadosIdentificacao,
  informacoesSaude,
  especificacaoLaudo,
  arquivos,
  queueId = '',
}) {
  const authenticatedUser = ensureAuthenticatedUser(user);

  return createSolicitacaoExameWithFallback({
    ...buildPacienteSnapshot(authenticatedUser),
    tipo: 'laudo_medico',
    exame_solicitado: '',
    motivo: especificacaoLaudo?.finalidade || '',
    sintomas: informacoesSaude?.diagnostico || '',
    status: 'pending',
    assintomatico_confirmado: false,
    dados_identificacao: dadosIdentificacao || {},
    informacoes_saude: informacoesSaude || {},
    dados_saude: informacoesSaude || {},
    especificacao_laudo: especificacaoLaudo || {},
    arquivos: arquivos || [],
    arquivos_urls: arquivos || [],
    fluxo_destino: 'plantao',
    especialidade_destino: CLINICO_GERAL,
    queue_id: queueId || '',
  });
}

export async function linkSolicitacaoExameToQueue(solicitacaoId, queueId) {
  if (!solicitacaoId || !queueId) {
    return null;
  }

  try {
    return await base44.entities.SolicitacaoExame.update(solicitacaoId, {
      queue_id: queueId,
    });
  } catch (error) {
    if (hasMissingColumnError(error, 'queue_id')) {
      optionalSolicitacaoFieldsSupported = false;
      return null;
    }

    throw error;
  }
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

  if (solicitacao.tipo === 'laudo_medico') {
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

export async function resolveLaudoSolicitacaoFromQueue(queueEntry) {
  if (!queueEntry?.patient_id) {
    return null;
  }

  if (queueEntry.solicitacao_exame_id) {
    const directMatch = await base44.entities.SolicitacaoExame.filter({ id: queueEntry.solicitacao_exame_id }, undefined, 1);
    if (directMatch?.[0]) {
      return directMatch[0];
    }
  }

  if (queueEntry.id) {
    try {
      const queueLinkedMatches = await base44.entities.SolicitacaoExame.filter({
        queue_id: queueEntry.id,
        tipo: 'laudo_medico',
      }, '-created_date', 5);

      if (queueLinkedMatches?.[0]) {
        return queueLinkedMatches[0];
      }
    } catch (error) {
      if (!hasMissingColumnError(error, 'queue_id')) {
        throw error;
      }
    }
  }

  const pendingMatches = await base44.entities.SolicitacaoExame.filter({
    paciente_id: queueEntry.patient_id,
    tipo: 'laudo_medico',
    status: 'pending',
  }, '-created_date', 5);

  if (pendingMatches?.[0]) {
    return pendingMatches[0];
  }

  const inProgressMatches = await base44.entities.SolicitacaoExame.filter({
    paciente_id: queueEntry.patient_id,
    tipo: 'laudo_medico',
    status: 'in_progress',
  }, '-created_date', 5);

  return inProgressMatches?.[0] || null;
}

export async function attachLaudoContextToQueue(queueEntries = []) {
  const normalizedEntries = queueEntries || [];

  if (normalizedEntries.length === 0) {
    return [];
  }

  const enrichedEntries = await Promise.all(
    normalizedEntries.map(async (entry) => {
      const laudoSolicitacao = await resolveLaudoSolicitacaoFromQueue(entry);

      return {
        ...entry,
        laudo_medico: laudoSolicitacao,
      };
    }),
  );

  return enrichedEntries;
}

export async function markLaudoSolicitacaoInProgress(queueEntry, professionalId) {
  if (!queueEntry?.patient_id || !professionalId) {
    return null;
  }

  const laudoSolicitacao = queueEntry.laudo_medico || await resolveLaudoSolicitacaoFromQueue(queueEntry);

  if (!laudoSolicitacao?.id) {
    return null;
  }

  return base44.entities.SolicitacaoExame.update(laudoSolicitacao.id, {
    status: 'in_progress',
    medico_id: professionalId,
  });
}

export function getLaudoAttachmentUrls(solicitacao) {
  if (!solicitacao) {
    return [];
  }

  if (Array.isArray(solicitacao.arquivos) && solicitacao.arquivos.length > 0) {
    return solicitacao.arquivos.filter(Boolean);
  }

  if (Array.isArray(solicitacao.arquivos_urls) && solicitacao.arquivos_urls.length > 0) {
    return solicitacao.arquivos_urls.filter(Boolean);
  }

  return [];
}
