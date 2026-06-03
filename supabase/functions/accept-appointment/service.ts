import { AppError } from '../_shared/errors.ts';
import {
  APPOINTMENT_EXPIRED_ERROR,
  isSpecialtyAppointmentRequestExpired,
} from '../_shared/appointments/expiration.ts';
import type {
  AcceptAppointmentCommand,
  AcceptAppointmentRepository,
  AcceptAppointmentTransactionRecord,
  AcceptAppointmentResult,
  AppointmentAcceptanceWindowRecord,
  PlanAppointmentAcceptanceContext,
  ProfessionalProfileRecord,
} from './types.ts';

const REQUESTED_APPOINTMENT_STATUSES = new Set(['requested', 'pending', 'SOLICITADO']);
const ACCEPTED_APPOINTMENT_STATUSES = new Set(['accepted', 'confirmed', 'CONFIRMADO', 'in_progress', 'em_atendimento']);

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeComparable(value: unknown) {
  return normalizeString(value).toLowerCase();
}

function assertAppointmentNotExpiredForAcceptance(appointment: AppointmentAcceptanceWindowRecord | null) {
  if (!appointment?.id) {
    throw new AppError({
      status: 404,
      code: 'APPOINTMENT_NOT_FOUND',
      message: 'Appointment not found.',
    });
  }

  if (isSpecialtyAppointmentRequestExpired({
    status: appointment.status,
    appointmentType: appointment.appointmentType,
    scheduledDatetime: appointment.scheduledDatetime,
    date: appointment.date,
    time: appointment.time,
  })) {
    throw new AppError({
      status: 409,
      code: APPOINTMENT_EXPIRED_ERROR.code,
      message: APPOINTMENT_EXPIRED_ERROR.message,
      details: { appointmentId: appointment.id },
    });
  }
}

function assertPlanAppointmentCanBeAcceptedByProfessional({
  context,
  professional,
}: {
  context: PlanAppointmentAcceptanceContext;
  professional: ProfessionalProfileRecord;
}) {
  const { appointment } = context;
  const status = normalizeString(appointment.status);

  if (ACCEPTED_APPOINTMENT_STATUSES.has(status)) {
    return;
  }

  if (!REQUESTED_APPOINTMENT_STATUSES.has(status)) {
    throw new AppError({
      status: 409,
      code: 'APPOINTMENT_NOT_REQUESTED',
      message: 'Appointment is not in a requested state.',
      details: { appointmentId: appointment.id, status },
    });
  }

  if (appointment.paymentRequired) {
    throw new AppError({
      status: 409,
      code: 'PLAN_APPOINTMENT_PAYMENT_REQUIRED_INVALID',
      message: 'Plan-funded appointment cannot require direct payment before acceptance.',
      details: { appointmentId: appointment.id },
    });
  }

  if (!appointment.planCreditUsageId) {
    throw new AppError({
      status: 409,
      code: 'PLAN_CREDIT_USAGE_REQUIRED',
      message: 'Plan-funded appointments require a pending credit usage audit.',
      details: { appointmentId: appointment.id },
    });
  }

  if (appointment.professionalId && appointment.professionalId !== professional.profileId) {
    throw new AppError({
      status: 403,
      code: 'PROFESSIONAL_PROFILE_MISMATCH',
      message: 'Professional is not allowed to accept this appointment.',
      details: { appointmentId: appointment.id },
    });
  }

  if (!appointment.professionalId && normalizeComparable(appointment.specialty) !== normalizeComparable(professional.specialty)) {
    throw new AppError({
      status: 403,
      code: 'APPOINTMENT_NOT_ELIGIBLE_FOR_PROFESSIONAL',
      message: 'Professional is not allowed to accept this appointment.',
      details: {
        appointmentId: appointment.id,
        appointmentSpecialty: appointment.specialty,
        professionalSpecialty: professional.specialty,
      },
    });
  }
}

function mapAcceptAppointmentResult(row: AcceptAppointmentTransactionRecord): AcceptAppointmentResult {
  return {
    appointment: {
      id: row.appointment_id,
      status: row.appointment_status,
      acceptedAt: row.appointment_accepted_at,
      scheduledAt: row.appointment_scheduled_datetime,
      professionalId: row.appointment_professional_id,
      professionalName: row.appointment_professional_name,
    },
    consulta: {
      id: row.consulta_id,
      status: row.consulta_status,
      tipoConsulta: row.consulta_tipo,
      datetime: row.consulta_datetime,
    },
  };
}

export async function acceptAppointment({
  requestId,
  appointmentId,
  authenticatedUser,
  repository,
}: {
  repository: AcceptAppointmentRepository;
} & AcceptAppointmentCommand): Promise<AcceptAppointmentResult> {
  const appUser = await repository.findAppUserByAuthUserId(authenticatedUser.authUserId);

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

  if (appUser.role !== 'professional') {
    throw new AppError({
      status: 403,
      code: 'PROFESSIONAL_ROLE_REQUIRED',
      message: 'Only professionals can accept appointments.',
    });
  }

  const professional = await repository.findActiveProfessionalProfileByUserId(appUser.id);

  if (!professional?.profileId) {
    throw new AppError({
      status: 403,
      code: 'PROFESSIONAL_PROFILE_NOT_FOUND',
      message: 'No active professional profile was found for this user.',
    });
  }

  console.info('[accept-appointment] request:start', {
    requestId,
    appointmentId,
    appUserId: appUser.id,
    profileId: professional.profileId,
  });

  const appointmentWindow = await repository.findAppointmentAcceptanceWindow(appointmentId);
  assertAppointmentNotExpiredForAcceptance(appointmentWindow);

  const planContext = await repository.findPlanAppointmentAcceptanceContext(appointmentId);
  let row: AcceptAppointmentTransactionRecord | null = null;

  if (planContext) {
    assertPlanAppointmentCanBeAcceptedByProfessional({
      context: planContext,
      professional,
    });

    if (ACCEPTED_APPOINTMENT_STATUSES.has(normalizeString(planContext.appointment.status))) {
      row = await repository.findAcceptedAppointmentResult({
        appointmentId,
        professionalProfileId: professional.profileId,
      });

      if (!row) {
        throw new AppError({
          status: 409,
          code: 'PLAN_APPOINTMENT_ALREADY_ACCEPTED',
          message: 'This plan-funded appointment was already accepted by another professional.',
        });
      }
    } else {
      const planCreditResult = await repository.confirmPlanCreditBeforeAcceptance({
        context: planContext,
      });

      console.info('[accept-appointment] plan-credit:confirmed', {
        requestId,
        appointmentId,
        planCreditUsageId: planContext.usage?.id || planContext.appointment.planCreditUsageId,
        skipped: planCreditResult.skipped,
        reason: planCreditResult.reason,
      });
    }
  }

  if (!row) {
    row = await repository.acceptAppointment({
      appointmentId,
      professionalAppUserId: professional.appUserId,
      professionalProfileId: professional.profileId,
    });
  }

  console.info('[accept-appointment] request:success', {
    requestId,
    appointmentId: row.appointment_id,
    consultaId: row.consulta_id,
    professionalId: row.appointment_professional_id,
  });

  return mapAcceptAppointmentResult(row);
}
