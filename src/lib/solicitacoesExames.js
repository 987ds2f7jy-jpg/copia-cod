import { entities } from '@/client-api/readModels';
import { joinQueueEntry } from '@/client-api/queues';
import {
  createSolicitacaoExameRequest,
  deleteSolicitacaoExameRequest,
  updateSolicitacaoExameRequest,
} from '@/client-api/solicitacoesExames';
import { canWorkOnDuty, normalizePlantaoSpecialty, normalizeSpecialty } from '@/lib/professionals';

const PLANTAO_STORAGE_KEY = 'rd.solicitacaoExames.plantao';
const LAUDO_WIZARD_STORAGE_KEY = 'rd.laudosMedicos.wizard';
const CLINICO_GERAL = 'clinico_geral';
const MAX_UPLOAD_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

function ensureAuthenticatedUser(user) {
  if (!user?.id) {
    throw new Error('E necessario estar logado para enviar a solicitacao.');
  }

  return user;
}

async function createSolicitacaoExame(payload) {
  return createSolicitacaoExameRequest(payload);
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
  ensureAuthenticatedUser(user);

  return createSolicitacaoExame({
    tipo: 'checkup',
    exameSolicitado: 'Check-Up Completo',
    motivo: 'Exames de rotina / check-up preventivo',
    sintomas: '',
    assintomaticoConfirmado: true,
    fluxoDestino: 'dashboard',
    especialidadeDestino: CLINICO_GERAL,
  });
}

export async function createSpecificExamRequest(user, { exame, motivo, sintomas }) {
  ensureAuthenticatedUser(user);

  return createSolicitacaoExame({
    tipo: 'especificos',
    exameSolicitado: exame,
    motivo: motivo || '',
    sintomas: sintomas || '',
    assintomaticoConfirmado: false,
    fluxoDestino: 'plantao',
    especialidadeDestino: CLINICO_GERAL,
  });
}

export async function createPrescriptionRenewalRequest(user, {
  nomeMedicamento,
  dosagem,
  frequencia,
  arquivoReceitaUrl,
}) {
  ensureAuthenticatedUser(user);

  return createSolicitacaoExame({
    tipo: 'renovacao_receitas',
    exameSolicitado: '',
    motivo: '',
    sintomas: '',
    assintomaticoConfirmado: false,
    nomeMedicamento,
    dosagem,
    frequencia,
    arquivoReceitaUrl,
    fluxoDestino: 'dashboard',
    especialidadeDestino: CLINICO_GERAL,
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

export function isLaudoQueueEntry(queueEntry) {
  if (!queueEntry) {
    return false;
  }

  if (queueEntry.solicitacao_exame_id) {
    return true;
  }

  const symptoms = String(queueEntry.symptoms || '').toLowerCase();
  return symptoms.includes('[laudo medico:');
}

export async function createQueueEntry(payload) {
  const result = await joinQueueEntry({
    specialty: payload.specialty,
    symptoms: payload.symptoms || '',
    priorityLevel: payload.priority_level || 'normal',
    solicitacaoExameId: payload.solicitacao_exame_id || '',
  });

  return result.queueEntry;
}

export async function findCurrentQueueEntry(patientId, specialty = CLINICO_GERAL) {
  if (!patientId) {
    return null;
  }

  const statuses = ['waiting', 'in_progress', 'em_atendimento'];
  const matches = await Promise.all(
    statuses.map((status) => entities.Queue.filter({
      patient_id: patientId,
      specialty,
      status,
      payment_status: 'paid',
    }, '-created_date', 5)),
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

  if (existingEntry && isLaudoQueueEntry(existingEntry)) {
    return {
      entry: existingEntry,
      reusedExisting: true,
    };
  }

  const result = await joinQueueEntry({
    specialty: CLINICO_GERAL,
    symptoms: buildLaudoQueueSymptoms({ tipoLaudo, diagnostico, finalidade }),
    priorityLevel: 'normal',
    solicitacaoExameId: solicitacaoExameId || '',
  });

  return {
    entry: result.queueEntry,
    reusedExisting: Boolean(result.reusedExisting),
  };
}

export async function createLaudoMedicoRequest(user, {
  dadosIdentificacao,
  informacoesSaude,
  especificacaoLaudo,
  arquivos,
  queueId = '',
}) {
  ensureAuthenticatedUser(user);

  return createSolicitacaoExame({
    tipo: 'laudo_medico',
    exameSolicitado: '',
    motivo: especificacaoLaudo?.finalidade || '',
    sintomas: informacoesSaude?.diagnostico || '',
    assintomaticoConfirmado: false,
    dadosIdentificacao: dadosIdentificacao || {},
    informacoesSaude: informacoesSaude || {},
    especificacaoLaudo: especificacaoLaudo || {},
    arquivos: arquivos || [],
    fluxoDestino: 'plantao',
    especialidadeDestino: CLINICO_GERAL,
    queueId: queueId || '',
  });
}

export async function linkSolicitacaoExameToQueue(solicitacaoId, queueId) {
  if (!solicitacaoId || !queueId) {
    return null;
  }

  return updateSolicitacaoExameRequest({
    solicitacaoId,
    queueId,
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

  return entities.SolicitacaoExame.filter({
    status: 'pending',
    fluxo_destino: 'dashboard',
    especialidade_destino: CLINICO_GERAL,
    payment_status: 'paid',
  }, '-created_date');
}

export async function resolveLaudoSolicitacaoFromQueue(queueEntry) {
  if (!queueEntry?.patient_id || !isLaudoQueueEntry(queueEntry)) {
    return null;
  }

  if (queueEntry.solicitacao_exame_id) {
    const directMatch = await entities.SolicitacaoExame.filter({ id: queueEntry.solicitacao_exame_id }, undefined, 1);
    if (directMatch?.[0]) {
      return directMatch[0];
    }
  }

  if (queueEntry.id) {
    const queueLinkedMatches = await entities.SolicitacaoExame.filter({
      queue_id: queueEntry.id,
      tipo: 'laudo_medico',
    }, '-created_date', 5);

    if (queueLinkedMatches?.[0]) {
      return queueLinkedMatches[0];
    }
  }

  const pendingMatches = await entities.SolicitacaoExame.filter({
    paciente_id: queueEntry.patient_id,
    tipo: 'laudo_medico',
    status: 'pending',
  }, '-created_date', 5);

  if (pendingMatches?.[0]) {
    return pendingMatches[0];
  }

  const inProgressMatches = await entities.SolicitacaoExame.filter({
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
      if (!isLaudoQueueEntry(entry)) {
        return {
          ...entry,
          laudo_medico: null,
        };
      }

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

  return updateSolicitacaoExameRequest({
    solicitacaoId: laudoSolicitacao.id,
    status: 'in_progress',
    medicoId: professionalId,
  });
}

export async function deleteSolicitacaoExame(solicitacaoId) {
  if (!solicitacaoId) {
    return null;
  }

  return deleteSolicitacaoExameRequest({
    solicitacaoId,
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
