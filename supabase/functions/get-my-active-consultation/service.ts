import {
  mapConsultationRecord,
  resolveConsultaParticipantRole,
} from '../_shared/teleconsulta.ts';
import type {
  ActiveConsultationRow,
  GetMyActiveConsultationCommand,
  GetMyActiveConsultationResult,
} from './types.ts';

const STATUS_PRIORITY: Record<string, number> = {
  em_atendimento: 0,
  in_progress: 1,
  aguardando: 2,
};

function buildEmptyResult(): GetMyActiveConsultationResult {
  return {
    hasActiveConsultation: false,
    consultation: null,
    participantRole: null,
    resumeUrl: null,
    roomReady: false,
    needsProfessionalStart: false,
    counterpartName: null,
  };
}

function getConsultationPriority(consultation: ActiveConsultationRow) {
  return STATUS_PRIORITY[String(consultation.status || '').trim()] ?? 99;
}

function toSortableTimestamp(consultation: ActiveConsultationRow) {
  const rawValue = consultation.inicio_at || consultation.datetime || consultation.created_date || '';
  const timestamp = Date.parse(String(rawValue).trim());
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function hasRoomReady(consultation: ActiveConsultationRow) {
  return Boolean(
    consultation.sala_id &&
    consultation.token_sala &&
    consultation.inicio_at,
  );
}

function getDistanceFromNow(consultation: ActiveConsultationRow) {
  const rawValue = consultation.inicio_at || consultation.datetime || consultation.created_date || '';
  const timestamp = Date.parse(String(rawValue).trim());

  if (!Number.isFinite(timestamp)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(timestamp - Date.now());
}

function pickBestActiveConsultation(consultations: ActiveConsultationRow[]) {
  return [...consultations].sort((left, right) => {
    const statusDiff = getConsultationPriority(left) - getConsultationPriority(right);

    if (statusDiff !== 0) {
      return statusDiff;
    }

    const roomReadyDiff = Number(hasRoomReady(right)) - Number(hasRoomReady(left));

    if (roomReadyDiff !== 0) {
      return roomReadyDiff;
    }

    if (String(left.status || '').trim() === 'aguardando' && String(right.status || '').trim() === 'aguardando') {
      const distanceDiff = getDistanceFromNow(left) - getDistanceFromNow(right);

      if (distanceDiff !== 0) {
        return distanceDiff;
      }
    }

    return toSortableTimestamp(right) - toSortableTimestamp(left);
  })[0] || null;
}

export async function getMyActiveConsultation({
  requestId,
  appUser,
  repository,
}: GetMyActiveConsultationCommand): Promise<GetMyActiveConsultationResult> {
  if (!['patient', 'professional'].includes(appUser.role)) {
    return buildEmptyResult();
  }

  const professionalIdentity = appUser.role === 'professional'
    ? await repository.findProfessionalIdentityByAppUserId(appUser.id)
    : null;

  const activeConsultations = appUser.role === 'patient'
    ? await repository.listActiveConsultationsForPatient(appUser.id)
    : await repository.listActiveConsultationsForProfessional({
      appUserId: appUser.id,
      professionalProfileId: professionalIdentity?.profileId || null,
    });

  const consultation = pickBestActiveConsultation(activeConsultations);

  if (!consultation?.id) {
    return buildEmptyResult();
  }

  const participantRole = resolveConsultaParticipantRole({
    consulta: consultation,
    appUserId: appUser.id,
    professionalProfileId: professionalIdentity?.profileId || null,
  });

  if (!participantRole) {
    return buildEmptyResult();
  }

  if (activeConsultations.length > 1) {
    console.warn('[get-my-active-consultation] multiple-active-consultations', {
      requestId,
      appUserId: appUser.id,
      consultationIds: activeConsultations.map((row) => row.id),
      selectedConsultationId: consultation.id,
    });
  }

  const roomReady = hasRoomReady(consultation);

  return {
    hasActiveConsultation: true,
    consultation: mapConsultationRecord(consultation),
    participantRole,
    resumeUrl: `/consulta/${consultation.id}`,
    roomReady,
    needsProfessionalStart: participantRole === 'patient' && !roomReady,
    counterpartName: participantRole === 'professional'
      ? (consultation.paciente_nome || null)
      : (consultation.profissional_nome || null),
  };
}
