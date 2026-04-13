export type ConsultationRow = {
  id: string;
  paciente_id: string;
  paciente_nome: string | null;
  paciente_email: string | null;
  profissional_id: string;
  profissional_user_id: string | null;
  profissional_nome: string | null;
  especialidade: string | null;
  tipo_consulta: string | null;
  status: string | null;
  datetime: string | null;
  descricao_sintomas: string | null;
  inicio_at: string | null;
  fim_at: string | null;
  sala_id: string | null;
  token_sala: string | null;
  preco: number | null;
};

export type ProntuarioRow = {
  id: string;
  consulta_id: string;
  paciente_id: string | null;
  profissional_id: string | null;
  modo: string | null;
  motivo_consulta: string | null;
  historico_risco: string | null;
  exames_imagem: string | null;
  exame_fisico: string | null;
  avaliacao_diagnostico: string | null;
  recomendacoes: string | null;
  created_date: string;
  updated_at: string;
};

export type ConsultaEvaluationRow = {
  id: string;
  consulta_id: string;
  paciente_id: string;
  profissional_id: string;
  nota: number;
  comentario: string | null;
  created_date: string;
  updated_at: string;
};

export type PatientSummaryRow = {
  id: string;
  full_name: string | null;
  birth_date: string | null;
  sex: string | null;
};

export type ProfessionalIdentityRow = {
  profileId: string;
  profileIds: string[];
  appUserId: string | null;
  fullName: string;
  specialty: string;
  source: 'professional_profiles';
};

export const ACTIVE_CONSULTATION_MAX_DURATION_MINUTES = 90;
const ACTIVE_CONSULTATION_MAX_DURATION_MS = ACTIVE_CONSULTATION_MAX_DURATION_MINUTES * 60 * 1000;

function toSafeString(value: unknown) {
  return String(value ?? '').trim();
}

function stripUnsafeCharacters(value: unknown, pattern = /[^a-zA-Z0-9_-]/g) {
  return toSafeString(value).replace(pattern, '');
}

export function buildConsultaRoomPayload(consulta: {
  id: string;
  sala_id?: string | null;
  token_sala?: string | null;
}) {
  const explicitRoomId = toSafeString(consulta.sala_id);
  const explicitRoomToken = stripUnsafeCharacters(consulta.token_sala, /[^a-zA-Z0-9]/g);

  return {
    roomId: explicitRoomId || `consulta-${consulta.id}`.slice(0, 200),
    roomToken: explicitRoomToken || stripUnsafeCharacters(consulta.id, /[^a-zA-Z0-9]/g).slice(0, 36),
  };
}

export function resolveConsultaParticipantRole({
  consulta,
  appUserId,
  professionalProfileId,
  professionalProfileIds,
}: {
  consulta: ConsultationRow;
  appUserId: string;
  professionalProfileId?: string | null;
  professionalProfileIds?: string[] | null;
}) {
  const normalizedProfileIds = new Set(
    [professionalProfileId, ...(professionalProfileIds || [])]
      .map((value) => toSafeString(value))
      .filter(Boolean),
  );

  if (consulta.paciente_id === appUserId) {
    return 'patient' as const;
  }

  if (
    normalizedProfileIds.has(toSafeString(consulta.profissional_id)) ||
    consulta.profissional_user_id === appUserId ||
    consulta.profissional_id === appUserId
  ) {
    return 'professional' as const;
  }

  return null;
}

export function isConsultaClosed(status: string | null | undefined) {
  return status === 'finalizada' || status === 'cancelada';
}

export function calculateDurationMinutes(startedAt?: string | null, finishedAt?: string | null) {
  if (!startedAt || !finishedAt) {
    return null;
  }

  const started = new Date(startedAt);
  const finished = new Date(finishedAt);

  if (Number.isNaN(started.getTime()) || Number.isNaN(finished.getTime())) {
    return null;
  }

  return Math.max(0, Math.round((finished.getTime() - started.getTime()) / 60000));
}

export function getConsultaStartTimestamp(consulta: {
  inicio_at?: string | null;
}) {
  const startedAt = toSafeString(consulta.inicio_at);

  if (!startedAt) {
    return null;
  }

  const timestamp = Date.parse(startedAt);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getConsultaExpirationDate(consulta: {
  inicio_at?: string | null;
}) {
  const startedAt = getConsultaStartTimestamp(consulta);

  if (startedAt == null) {
    return null;
  }

  return new Date(startedAt + ACTIVE_CONSULTATION_MAX_DURATION_MS);
}

export function isConsultaExpiredForResume(
  consulta: {
    status?: string | null;
    inicio_at?: string | null;
  },
  now = Date.now(),
) {
  if (isConsultaClosed(consulta.status)) {
    return false;
  }

  const startedAt = getConsultaStartTimestamp(consulta);

  if (startedAt == null) {
    return false;
  }

  return now - startedAt > ACTIVE_CONSULTATION_MAX_DURATION_MS;
}

export function mapConsultationRecord(row: ConsultationRow) {
  return {
    id: row.id,
    patientId: row.paciente_id,
    patientName: row.paciente_nome || '',
    patientEmail: row.paciente_email || '',
    professionalId: row.profissional_id,
    professionalUserId: row.profissional_user_id || '',
    professionalName: row.profissional_nome || '',
    specialty: row.especialidade || '',
    consultationType: row.tipo_consulta || '',
    status: row.status || '',
    datetime: row.datetime || '',
    symptoms: row.descricao_sintomas || '',
    startedAt: row.inicio_at || '',
    finishedAt: row.fim_at || '',
    roomId: row.sala_id || '',
    roomToken: row.token_sala || '',
    price: Number(row.preco || 0),
    durationMinutes: calculateDurationMinutes(row.inicio_at, row.fim_at),
  };
}

export function mapProntuarioRecord(row: ProntuarioRow) {
  return {
    id: row.id,
    consultationId: row.consulta_id,
    patientId: row.paciente_id || '',
    professionalId: row.profissional_id || '',
    mode: row.modo || 'completo',
    motivoConsulta: row.motivo_consulta || '',
    historicoRisco: row.historico_risco || '',
    examesImagem: row.exames_imagem || '',
    exameFisico: row.exame_fisico || '',
    avaliacaoDiagnostico: row.avaliacao_diagnostico || '',
    recomendacoes: row.recomendacoes || '',
    createdAt: row.created_date,
    updatedAt: row.updated_at,
  };
}

export function mapConsultaEvaluationRecord(row: ConsultaEvaluationRow) {
  return {
    id: row.id,
    consultationId: row.consulta_id,
    patientId: row.paciente_id,
    professionalId: row.profissional_id,
    rating: Number(row.nota || 0),
    comment: row.comentario || '',
    createdAt: row.created_date,
    updatedAt: row.updated_at,
  };
}

export function mapPatientSummaryRecord({
  patient,
  latestProntuario,
}: {
  patient: PatientSummaryRow;
  latestProntuario?: ProntuarioRow | null;
}) {
  return {
    id: patient.id,
    fullName: patient.full_name || '',
    birthDate: patient.birth_date || '',
    sex: patient.sex || '',
    latestRiskHistory: latestProntuario?.historico_risco || '',
    latestProntuarioId: latestProntuario?.id || '',
    latestProntuarioAt: latestProntuario?.created_date || '',
  };
}
