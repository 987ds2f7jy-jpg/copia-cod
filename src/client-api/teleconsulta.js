import { invokeEdgeFunction } from './edgeFunctions';

function toTrimmedString(value) {
  return String(value ?? '').trim();
}

function normalizeConsultation(consultation) {
  if (!consultation) {
    return null;
  }

  const normalized = {
    id: consultation.id || '',
    patientId: consultation.patientId ?? consultation.paciente_id ?? '',
    patientName: consultation.patientName ?? consultation.paciente_nome ?? '',
    patientEmail: consultation.patientEmail ?? consultation.paciente_email ?? '',
    professionalId: consultation.professionalId ?? consultation.profissional_id ?? '',
    professionalUserId: consultation.professionalUserId ?? consultation.profissional_user_id ?? '',
    professionalName: consultation.professionalName ?? consultation.profissional_nome ?? '',
    specialty: consultation.specialty ?? consultation.especialidade ?? '',
    consultationType: consultation.consultationType ?? consultation.tipo_consulta ?? '',
    status: consultation.status ?? '',
    datetime: consultation.datetime ?? '',
    symptoms: consultation.symptoms ?? consultation.descricao_sintomas ?? '',
    startedAt: consultation.startedAt ?? consultation.inicio_at ?? '',
    finishedAt: consultation.finishedAt ?? consultation.fim_at ?? '',
    roomId: consultation.roomId ?? consultation.sala_id ?? '',
    roomToken: consultation.roomToken ?? consultation.token_sala ?? '',
    price: Number(consultation.price ?? consultation.preco ?? 0),
    durationMinutes: consultation.durationMinutes ?? null,
  };

  return {
    ...normalized,
    paciente_id: normalized.patientId,
    paciente_nome: normalized.patientName,
    paciente_email: normalized.patientEmail,
    profissional_id: normalized.professionalId,
    profissional_user_id: normalized.professionalUserId,
    profissional_nome: normalized.professionalName,
    especialidade: normalized.specialty,
    tipo_consulta: normalized.consultationType,
    descricao_sintomas: normalized.symptoms,
    inicio_at: normalized.startedAt,
    fim_at: normalized.finishedAt,
    sala_id: normalized.roomId,
    token_sala: normalized.roomToken,
    preco: normalized.price,
  };
}

function normalizeProntuario(prontuario) {
  if (!prontuario) {
    return null;
  }

  const normalized = {
    id: prontuario.id || '',
    consultationId: prontuario.consultationId ?? prontuario.consulta_id ?? '',
    patientId: prontuario.patientId ?? prontuario.paciente_id ?? '',
    professionalId: prontuario.professionalId ?? prontuario.profissional_id ?? '',
    mode: prontuario.mode ?? prontuario.modo ?? 'completo',
    motivoConsulta: prontuario.motivoConsulta ?? prontuario.motivo_consulta ?? '',
    historicoRisco: prontuario.historicoRisco ?? prontuario.historico_risco ?? '',
    examesImagem: prontuario.examesImagem ?? prontuario.exames_imagem ?? '',
    exameFisico: prontuario.exameFisico ?? prontuario.exame_fisico ?? '',
    avaliacaoDiagnostico: prontuario.avaliacaoDiagnostico ?? prontuario.avaliacao_diagnostico ?? '',
    recomendacoes: prontuario.recomendacoes ?? '',
    createdAt: prontuario.createdAt ?? prontuario.created_date ?? '',
    updatedAt: prontuario.updatedAt ?? prontuario.updated_at ?? '',
  };

  return {
    ...normalized,
    consulta_id: normalized.consultationId,
    paciente_id: normalized.patientId,
    profissional_id: normalized.professionalId,
    modo: normalized.mode,
    motivo_consulta: normalized.motivoConsulta,
    historico_risco: normalized.historicoRisco,
    exames_imagem: normalized.examesImagem,
    exame_fisico: normalized.exameFisico,
    avaliacao_diagnostico: normalized.avaliacaoDiagnostico,
    created_date: normalized.createdAt,
    updated_at: normalized.updatedAt,
  };
}

function normalizeEvaluation(evaluation) {
  if (!evaluation) {
    return null;
  }

  const normalized = {
    id: evaluation.id || '',
    consultationId: evaluation.consultationId ?? evaluation.consulta_id ?? '',
    patientId: evaluation.patientId ?? evaluation.paciente_id ?? '',
    professionalId: evaluation.professionalId ?? evaluation.profissional_id ?? '',
    rating: Number(evaluation.rating ?? evaluation.nota ?? 0),
    comment: evaluation.comment ?? evaluation.comentario ?? '',
    createdAt: evaluation.createdAt ?? evaluation.created_date ?? '',
    updatedAt: evaluation.updatedAt ?? evaluation.updated_at ?? '',
  };

  return {
    ...normalized,
    consulta_id: normalized.consultationId,
    paciente_id: normalized.patientId,
    profissional_id: normalized.professionalId,
    nota: normalized.rating,
    comentario: normalized.comment,
    created_date: normalized.createdAt,
    updated_at: normalized.updatedAt,
  };
}

function normalizePatientSummary(summary) {
  if (!summary) {
    return null;
  }

  const normalized = {
    id: summary.id || '',
    fullName: summary.fullName ?? summary.full_name ?? '',
    birthDate: summary.birthDate ?? summary.birth_date ?? '',
    sex: summary.sex ?? '',
    latestRiskHistory: summary.latestRiskHistory ?? summary.latest_risk_history ?? '',
    latestProntuarioId: summary.latestProntuarioId ?? summary.latest_prontuario_id ?? '',
    latestProntuarioAt: summary.latestProntuarioAt ?? summary.latest_prontuario_at ?? '',
  };

  return {
    ...normalized,
    full_name: normalized.fullName,
    birth_date: normalized.birthDate,
    latest_risk_history: normalized.latestRiskHistory,
    latest_prontuario_id: normalized.latestProntuarioId,
    latest_prontuario_at: normalized.latestProntuarioAt,
  };
}

function normalizeParticipant(participant) {
  if (!participant) {
    return null;
  }

  return {
    appUserId: participant.appUserId ?? '',
    role: participant.role === 'professional' ? 'professional' : 'patient',
    isParticipant: Boolean(participant.isParticipant),
    professionalProfileId: participant.professionalProfileId ?? '',
    canStartSession: Boolean(participant.canStartSession),
    canFinishSession: Boolean(participant.canFinishSession),
    canUpsertProntuario: Boolean(participant.canUpsertProntuario),
    canSubmitEvaluation: Boolean(participant.canSubmitEvaluation),
  };
}

function normalizeTeleconsultaContext(result) {
  return {
    consultation: normalizeConsultation(result?.consultation),
    participant: normalizeParticipant(result?.participant),
    currentProntuario: normalizeProntuario(result?.currentProntuario),
    recentProntuarios: Array.isArray(result?.recentProntuarios)
      ? result.recentProntuarios.map(normalizeProntuario).filter(Boolean)
      : [],
    currentEvaluation: normalizeEvaluation(result?.currentEvaluation),
    patientSummary: normalizePatientSummary(result?.patientSummary),
    patientSummaries: Array.isArray(result?.patientSummaries)
      ? result.patientSummaries.map(normalizePatientSummary).filter(Boolean)
      : [],
  };
}

function normalizeActiveConsultation(result) {
  const consultation = normalizeConsultation(result?.consultation);

  return {
    hasActiveConsultation: Boolean(result?.hasActiveConsultation && consultation?.id),
    consultation,
    participantRole: result?.participantRole === 'professional'
      ? 'professional'
      : result?.participantRole === 'patient'
        ? 'patient'
        : null,
    resumeUrl: consultation?.id
      ? String(result?.resumeUrl || `/consulta/${consultation.id}`).trim()
      : null,
    roomReady: Boolean(result?.roomReady),
    needsProfessionalStart: Boolean(result?.needsProfessionalStart),
    counterpartName: String(result?.counterpartName ?? '').trim() || null,
  };
}

export async function getTeleconsultaContextRequest({
  consultationId = null,
  patientId = null,
  patientIds = [],
  historyLimit = 20,
  excludeConsultationId = null,
} = {}) {
  const result = await invokeEdgeFunction('get-teleconsulta-context', {
    body: {
      consultationId: consultationId || null,
      patientId: patientId || null,
      patientIds: Array.isArray(patientIds)
        ? patientIds.map(toTrimmedString).filter(Boolean)
        : [],
      historyLimit,
      excludeConsultationId: excludeConsultationId || null,
    },
    fallbackMessage: 'Nao foi possivel carregar o contexto da teleconsulta.',
  });

  return normalizeTeleconsultaContext(result);
}

export async function getMyActiveConsultationRequest() {
  const result = await invokeEdgeFunction('get-my-active-consultation', {
    body: {},
    fallbackMessage: 'Nao foi possivel identificar consulta ativa para retomada.',
  });

  return normalizeActiveConsultation(result);
}

export async function startConsultaSessionRequest({ consultationId }) {
  const result = await invokeEdgeFunction('start-consulta-session', {
    body: {
      consultationId,
    },
    fallbackMessage: 'Nao foi possivel iniciar a sessao da teleconsulta.',
  });

  return {
    ...result,
    consultation: normalizeConsultation(result?.consultation),
  };
}

export async function upsertProntuarioRequest({
  consultationId,
  mode = 'completo',
  motivoConsulta = '',
  historicoRisco = '',
  examesImagem = '',
  exameFisico = '',
  avaliacaoDiagnostico = '',
  recomendacoes = '',
}) {
  const result = await invokeEdgeFunction('upsert-prontuario', {
    body: {
      consultationId,
      mode,
      motivoConsulta,
      historicoRisco,
      examesImagem,
      exameFisico,
      avaliacaoDiagnostico,
      recomendacoes,
    },
    fallbackMessage: 'Nao foi possivel salvar o prontuario.',
  });

  return {
    ...result,
    consultation: normalizeConsultation(result?.consultation),
    prontuario: normalizeProntuario(result?.prontuario),
  };
}

export async function finishConsultaRequest({ consultationId }) {
  const result = await invokeEdgeFunction('finish-consulta', {
    body: {
      consultationId,
    },
    fallbackMessage: 'Nao foi possivel finalizar a consulta.',
  });

  return {
    ...result,
    consultation: normalizeConsultation(result?.consultation),
  };
}

export async function submitConsultaEvaluationRequest({
  consultationId,
  rating,
  comment = '',
}) {
  const result = await invokeEdgeFunction('submit-consulta-evaluation', {
    body: {
      consultationId,
      rating,
      comment,
    },
    fallbackMessage: 'Nao foi possivel enviar a avaliacao da consulta.',
  });

  return {
    ...result,
    evaluation: normalizeEvaluation(result?.evaluation),
  };
}

export async function requestZoomToken({
  consultationId,
  participantRole,
  userName,
}) {
  return invokeEdgeFunction('zoom-token', {
    body: {
      consultationId,
      participantRole,
      userName,
    },
    fallbackMessage: 'Nao foi possivel iniciar a sessao segura de video.',
  });
}

export async function requestGroqCompletion({ consultationId, transcript }) {
  return invokeEdgeFunction('groq-completion', {
    body: {
      consultationId,
      transcript,
    },
    fallbackMessage: 'Nao foi possivel processar a transcricao com IA.',
  });
}

export async function requestDeepgramToken({ consultationId }) {
  return invokeEdgeFunction('deepgram-token', {
    body: {
      consultationId,
    },
    fallbackMessage: 'Nao foi possivel obter o token de transcricao.',
  });
}

const teleconsultaApi = {
  getMyActiveConsultationRequest,
  getTeleconsultaContextRequest,
  startConsultaSessionRequest,
  upsertProntuarioRequest,
  finishConsultaRequest,
  submitConsultaEvaluationRequest,
  requestZoomToken,
  requestGroqCompletion,
  requestDeepgramToken,
};

export default teleconsultaApi;
