import { AppError } from '../_shared/errors.ts';
import {
  isConsultaClosed,
  mapConsultaEvaluationRecord,
  mapConsultationRecord,
  mapPatientSummaryRecord,
  mapProntuarioRecord,
  resolveConsultaParticipantRole,
} from '../_shared/teleconsulta.ts';
import type {
  GetTeleconsultaContextCommand,
  GetTeleconsultaContextRepository,
  TeleconsultaContextResult,
  TeleconsultaParticipantContext,
} from './types.ts';

function ensureActiveAppUser(appUser: Awaited<ReturnType<GetTeleconsultaContextRepository['findAppUserByAuthUserId']>>) {
  if (!appUser?.id) {
    throw new AppError({
      status: 403,
      code: 'APP_USER_NOT_FOUND',
      message: 'Authenticated user is not linked to app_users.',
    });
  }

  if (appUser.isActive === false) {
    throw new AppError({
      status: 403,
      code: 'ACCOUNT_INACTIVE',
      message: 'Authenticated account is inactive.',
    });
  }

  return appUser;
}

function buildParticipantContext({
  appUserId,
  role,
  professionalProfileId,
  consultationStatus,
}: {
  appUserId: string;
  role: 'patient' | 'professional';
  professionalProfileId: string | null;
  consultationStatus: string;
}): TeleconsultaParticipantContext {
  const closed = isConsultaClosed(consultationStatus);

  return {
    appUserId,
    role,
    isParticipant: true,
    professionalProfileId,
    canStartSession: role === 'professional' && !closed,
    canFinishSession: role === 'professional' && !closed,
    canUpsertProntuario: role === 'professional' && !closed,
    canSubmitEvaluation: role === 'patient' && consultationStatus === 'finalizada',
  };
}

export async function getTeleconsultaContext({
  input,
  authenticatedUser,
  repository,
}: {
  repository: GetTeleconsultaContextRepository;
} & GetTeleconsultaContextCommand): Promise<TeleconsultaContextResult> {
  const appUser = ensureActiveAppUser(
    await repository.findAppUserByAuthUserId(authenticatedUser.authUserId),
  );

  if (input.patientIds.length > 0) {
    if (!['professional', 'admin'].includes(appUser.role)) {
      throw new AppError({
        status: 403,
        code: 'PROFESSIONAL_ROLE_REQUIRED',
        message: 'Only professionals can load patient clinical summaries in bulk.',
      });
    }

    const [patients, prontuarios] = await Promise.all([
      repository.listPatientsByIds(input.patientIds),
      repository.listLatestProntuariosByPatientIds(input.patientIds),
    ]);

    const latestProntuariosByPatient = new Map<string, (typeof prontuarios)[number]>();
    prontuarios.forEach((row) => {
      if (!row.paciente_id || latestProntuariosByPatient.has(row.paciente_id)) {
        return;
      }

      latestProntuariosByPatient.set(row.paciente_id, row);
    });

    return {
      consultation: null,
      participant: null,
      currentProntuario: null,
      recentProntuarios: [],
      currentEvaluation: null,
      patientSummary: null,
      patientSummaries: patients.map((patient) => mapPatientSummaryRecord({
        patient,
        latestProntuario: latestProntuariosByPatient.get(patient.id) || null,
      })),
    };
  }

  if (input.patientId) {
    if (!['professional', 'admin'].includes(appUser.role)) {
      throw new AppError({
        status: 403,
        code: 'PROFESSIONAL_ROLE_REQUIRED',
        message: 'Only professionals can load patient clinical summaries.',
      });
    }

    const [patient, recentProntuarios] = await Promise.all([
      repository.findPatientById(input.patientId),
      repository.listPatientProntuarios({
        patientId: input.patientId,
        historyLimit: input.historyLimit,
        excludeConsultationId: input.excludeConsultationId,
      }),
    ]);

    return {
      consultation: null,
      participant: null,
      currentProntuario: null,
      recentProntuarios: recentProntuarios.map(mapProntuarioRecord),
      currentEvaluation: null,
      patientSummary: patient
        ? mapPatientSummaryRecord({
          patient,
          latestProntuario: recentProntuarios[0] || null,
        })
        : null,
      patientSummaries: [],
    };
  }

  if (!input.consultationId) {
    throw new AppError({
      status: 400,
      code: 'CONSULTATION_ID_REQUIRED',
      message: '"consultationId" is required.',
    });
  }

  const consultation = await repository.findConsultationById(input.consultationId);

  if (!consultation?.id) {
    throw new AppError({
      status: 404,
      code: 'CONSULTATION_NOT_FOUND',
      message: 'Telemedicine consultation not found.',
    });
  }

  const professionalIdentity = appUser.role === 'professional'
    ? await repository.findProfessionalIdentityByAppUserId(appUser.id)
    : null;

  const participantRole = resolveConsultaParticipantRole({
    consulta: consultation,
    appUserId: appUser.id,
    professionalProfileId: professionalIdentity?.profileId || null,
  });

  if (!participantRole) {
    throw new AppError({
      status: 403,
      code: 'CONSULTATION_ACCESS_FORBIDDEN',
      message: 'Authenticated user does not belong to this consultation.',
    });
  }

  const [currentProntuario, recentProntuarios, patient, currentEvaluation] = await Promise.all([
    repository.findProntuarioByConsultationId(consultation.id),
    repository.listPatientProntuarios({
      patientId: consultation.paciente_id,
      historyLimit: input.historyLimit,
      excludeConsultationId: consultation.id,
    }),
    repository.findPatientById(consultation.paciente_id),
    participantRole === 'patient'
      ? repository.findConsultaEvaluation({
        consultationId: consultation.id,
        patientId: appUser.id,
      })
      : Promise.resolve(null),
  ]);

  return {
    consultation: mapConsultationRecord(consultation),
    participant: buildParticipantContext({
      appUserId: appUser.id,
      role: participantRole,
      professionalProfileId: professionalIdentity?.profileId || null,
      consultationStatus: consultation.status || '',
    }),
    currentProntuario: currentProntuario ? mapProntuarioRecord(currentProntuario) : null,
    recentProntuarios: recentProntuarios.map(mapProntuarioRecord),
    currentEvaluation: currentEvaluation ? mapConsultaEvaluationRecord(currentEvaluation) : null,
    patientSummary: patient
      ? mapPatientSummaryRecord({
        patient,
        latestProntuario: recentProntuarios[0] || currentProntuario || null,
      })
      : null,
    patientSummaries: [],
  };
}
