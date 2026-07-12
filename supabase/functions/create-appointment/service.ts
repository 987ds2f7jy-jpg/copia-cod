import { AppError } from '../_shared/errors.ts';
import { isApprovedProfessionalStatus } from '../_shared/domains/professionalStatus.ts';
import {
  normalizePricingSpecialty,
  PROFILE_PRIORITY_SERVICE_CODE,
  PROFILE_STANDARD_SERVICE_CODE,
  SPECIALTY_REQUEST_SERVICE_CODE,
} from '../_shared/pricing/service-codes.ts';
import type { ServiceCode } from '../_shared/pricing/types.ts';
import type {
  CreateAppointmentCommand,
  CreateAppointmentRepository,
  CreateAppointmentResult,
  PlanCoverageVerification,
} from './types.ts';

const VALID_MINUTES = new Set([0, 20, 40]);
const ACTIVE_APPOINTMENT_STATUSES = ['CONFIRMADO', 'accepted', 'confirmed', 'in_progress', 'em_atendimento'];

function buildScheduledDatetime(date: string, time: string) {
  return `${date}T${time}:00`;
}

function normalizeWeekday(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

function validateTimeSlot(time: string) {
  const [hoursRaw, minutesRaw] = time.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    throw new AppError({
      status: 400,
      code: 'TIME_INVALID',
      message: 'Time must be valid.',
    });
  }

  if (hours < 8 || hours >= 18) {
    throw new AppError({
      status: 422,
      code: 'SCHEDULING_TIME_OUT_OF_RANGE',
      message: 'Time must be between 08:00 and 17:40.',
    });
  }

  if (!VALID_MINUTES.has(minutes)) {
    throw new AppError({
      status: 422,
      code: 'SCHEDULING_TIME_STEP_INVALID',
      message: 'Minutes must be one of 00, 20 or 40.',
    });
  }
}

function validateSchedulingWindow(scheduledDatetime: string, priority: boolean) {
  const now = new Date();
  const scheduledAt = new Date(scheduledDatetime);

  if (Number.isNaN(scheduledAt.getTime())) {
    throw new AppError({
      status: 400,
      code: 'SCHEDULED_DATETIME_INVALID',
      message: 'Scheduled datetime is invalid.',
    });
  }

  if (priority) {
    const minDate = new Date(now.getTime() + 1 * 60 * 60 * 1000);
    const maxDate = new Date(now.getTime() + 36 * 60 * 60 * 1000);

    if (scheduledAt <= minDate) {
      throw new AppError({
        status: 422,
        code: 'SCHEDULING_WINDOW_INVALID',
        message: 'Priority appointments require at least 1 hour of lead time.',
      });
    }

    if (scheduledAt > maxDate) {
      throw new AppError({
        status: 422,
        code: 'SCHEDULING_WINDOW_INVALID',
        message: 'Priority appointments are only available within the next 36 hours.',
      });
    }

    return;
  }

  const minDate = new Date(now.getTime() + 36 * 60 * 60 * 1000);
  const maxDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  if (scheduledAt < minDate) {
    throw new AppError({
      status: 422,
      code: 'SCHEDULING_WINDOW_INVALID',
      message: 'Appointments require at least 36 hours of lead time.',
    });
  }

  if (scheduledAt > maxDate) {
    throw new AppError({
      status: 422,
      code: 'SCHEDULING_WINDOW_INVALID',
      message: 'Appointments can only be scheduled up to 14 days ahead.',
    });
  }
}

function assertTargetAvailability({
  weekday,
  time,
  availabilitySlots,
  availableHours,
}: {
  weekday: number;
  time: string;
  availabilitySlots: { weekday: number; timeSlot: string }[];
  availableHours: string[];
}) {
  if (availabilitySlots.length > 0) {
    const configuredSlots = availabilitySlots
      .filter((slot) => slot.weekday === weekday)
      .map((slot) => slot.timeSlot);

    if (!configuredSlots.includes(time)) {
      throw new AppError({
        status: 422,
        code: 'AVAILABILITY_SLOT_NOT_AVAILABLE',
        message: 'Selected slot is not available for this professional.',
      });
    }

    return;
  }

  if (Array.isArray(availableHours) && availableHours.length > 0 && !availableHours.includes(time)) {
    throw new AppError({
      status: 422,
      code: 'AVAILABLE_HOUR_NOT_AVAILABLE',
      message: 'Selected slot is not available for this professional.',
    });
  }
}

export async function createAppointment({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: CreateAppointmentRepository;
} & CreateAppointmentCommand): Promise<CreateAppointmentResult> {
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

  if (appUser.role === 'professional') {
    throw new AppError({
      status: 403,
      code: 'PATIENT_ROLE_REQUIRED',
      message: 'Professional accounts cannot create patient appointments.',
    });
  }

  validateTimeSlot(input.time);

  const scheduledDatetime = buildScheduledDatetime(input.date, input.time);
  validateSchedulingWindow(scheduledDatetime, input.priority);

  let professionalId: string | null = null;
  let professionalName = '';
  let specialty = input.specialty.trim();
  let appointmentType = 'ESPECIALIDADE';
  let status = 'SOLICITADO';
  let serviceCode: ServiceCode = SPECIALTY_REQUEST_SERVICE_CODE;
  let pricingProfessionalProfileId: string | null = null;
  let pricingSpecialty: string | null = null;
  let planCoverage: PlanCoverageVerification | null = null;

  if (input.professionalProfileId) {
    if (input.fundingSource === 'plan') {
      throw new AppError({
        status: 422,
        code: 'PLAN_FUNDING_NOT_ALLOWED_FOR_PROFILE',
        message: 'Plan coverage is not available for appointments by professional profile.',
      });
    }

    const professional = await repository.findProfessionalTargetById(input.professionalProfileId);

    if (!professional?.profileId) {
      throw new AppError({
        status: 404,
        code: 'PROFESSIONAL_PROFILE_NOT_FOUND',
        message: 'Professional profile not found.',
      });
    }

    if (!isApprovedProfessionalStatus(professional.status)) {
      throw new AppError({
        status: 403,
        code: 'PROFESSIONAL_PROFILE_NOT_APPROVED',
        message: 'Professional profile must be approved.',
      });
    }

    const weekday = normalizeWeekday(input.date);
    const availabilitySlots = await repository.listAvailabilitySlots(professional.profileId);
    assertTargetAvailability({
      weekday,
      time: input.time,
      availabilitySlots,
      availableHours: professional.availableHours,
    });

    const hasConflict = await repository.hasActiveAppointmentConflict({
      professionalId: professional.profileId,
      scheduledDatetime,
    });

    if (hasConflict) {
      throw new AppError({
        status: 409,
        code: 'APPOINTMENT_SCHEDULE_CONFLICT',
        message: 'Selected slot is no longer available.',
      });
    }

    professionalId = professional.profileId;
    professionalName = professional.fullName;
    specialty = professional.specialty;
    appointmentType = input.priority ? 'priority' : 'PERFIL';
    status = 'SOLICITADO';
    serviceCode = input.priority ? PROFILE_PRIORITY_SERVICE_CODE : PROFILE_STANDARD_SERVICE_CODE;
    pricingProfessionalProfileId = professional.profileId;
  } else {
    specialty = input.specialty.trim();

    if (!specialty) {
      throw new AppError({
        status: 400,
        code: 'SPECIALTY_REQUIRED',
        message: 'Specialty is required.',
      });
    }

    appointmentType = 'ESPECIALIDADE';
    status = 'SOLICITADO';
    serviceCode = SPECIALTY_REQUEST_SERVICE_CODE;
    pricingSpecialty = specialty;
  }

  if (input.fundingSource === 'plan') {
    if (appointmentType !== 'ESPECIALIDADE' || professionalId) {
      throw new AppError({
        status: 422,
        code: 'PLAN_FUNDING_NOT_ALLOWED_FOR_FLOW',
        message: 'Plan coverage is only available for appointments by specialty.',
      });
    }

    planCoverage = await repository.verifyPlanCoverageForSpecialty({
      appUserId: appUser.id,
      fallbackExternalKey: appUser.email || authenticatedUser.email || '',
      specialtyCode: normalizePricingSpecialty(specialty),
    });
  }

  const pricing = await repository.resolveServicePricing({
    serviceCode,
    professionalProfileId: pricingProfessionalProfileId,
    specialty: pricingSpecialty,
  });
  const price = pricing.grossPrice;

  console.info('[create-appointment] request:start', {
    requestId,
    patientId: appUser.id,
    professionalId,
    appointmentType,
    serviceCode,
    fundingSource: input.fundingSource,
    scheduledDatetime,
    specialty: normalizePricingSpecialty(specialty),
  });

  const appointment = await repository.createAppointment({
    patientId: appUser.id,
    patientName: appUser.fullName,
    patientEmail: appUser.email,
    professionalId,
    professionalName,
    specialty,
    appointmentType,
    scheduledDatetime,
    date: input.date,
    time: input.time,
    status,
    price,
    pricing,
    symptoms: input.symptoms,
    fundingSource: input.fundingSource,
    planCoverage,
  });

  console.info('[create-appointment] request:success', {
    requestId,
    appointmentId: appointment.id,
    patientId: appointment.patient_id,
    professionalId: appointment.professional_id,
    status: appointment.status,
    serviceCode: appointment.service_code,
    grossPrice: appointment.gross_price,
    fundingSource: appointment.funding_source,
    paymentRequired: appointment.payment_required,
    planCreditUsageId: appointment.plan_credit_usage_id,
  });

  return {
    appointment: {
      id: appointment.id,
      status: appointment.status || status,
      appointmentType: appointment.appointment_type || appointmentType,
      scheduledDatetime: appointment.scheduled_datetime || scheduledDatetime,
      date: appointment.date || input.date,
      time: appointment.time || input.time,
      specialty: appointment.specialty || specialty,
      professionalId: appointment.professional_id || professionalId,
      professionalName: appointment.professional_name || professionalName,
      price: Number(appointment.price || price || 0),
      paymentStatus: appointment.payment_status || 'payment_pending',
      paymentRequired: Boolean(appointment.payment_required ?? true),
      currentPaymentChargeId: appointment.current_payment_charge_id || null,
      fundingSource: appointment.funding_source || input.fundingSource,
      coverageStatus: appointment.coverage_status || null,
      planCreditUsageId: appointment.plan_credit_usage_id || null,
      planSubscriptionOrderId: appointment.plan_subscription_order_id || null,
      externalSubscriptionScoreId: appointment.external_subscription_score_id || null,
      externalScoreId: appointment.external_score_id || null,
      externalPlanId: appointment.external_plan_id || null,
      externalSpecializationId: appointment.external_specialization_id || null,
    },
    payment: appointment.payment || null,
  };
}
