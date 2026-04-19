import { AppError } from '../_shared/errors.ts';
import { isApprovedProfessionalStatus } from '../_shared/domains/professionalStatus.ts';
import {
  getFeeGroupForServiceCode,
  getOnDutyServiceCodeForSpecialty,
  normalizePricingSpecialty,
} from '../_shared/pricing/service-codes.ts';
import type { ResolvedServicePricing, ServiceCode } from '../_shared/pricing/types.ts';
import type {
  JoinQueueCommand,
  JoinQueueRepository,
  JoinQueueResult,
  QueueRecord,
  SolicitacaoPaymentSnapshotRecord,
} from './types.ts';

function normalizePlantaoSpecialty(value: string) {
  return normalizePricingSpecialty(value);
}

function buildQueueResult(queueEntry: QueueRecord, reusedExisting: boolean): JoinQueueResult {
  return {
    queueEntry: {
      id: queueEntry.id,
      status: queueEntry.status || '',
      specialty: queueEntry.specialty || '',
      position: Number(queueEntry.position || 0),
      estimatedWaitTime: Number(queueEntry.estimated_wait_time || 0),
      assignedProfessionalId: queueEntry.assigned_professional_id || '',
      solicitacaoExameId: queueEntry.solicitacao_exame_id || '',
      serviceCode: queueEntry.service_code || '',
      quotedGrossPrice: Number(queueEntry.quoted_gross_price || 0),
      paymentStatus: queueEntry.payment_status || 'payment_pending',
      currentPaymentChargeId: queueEntry.current_payment_charge_id || null,
    },
    payment: queueEntry.payment || null,
    reusedExisting,
  };
}

function buildPricingFromSolicitacaoSnapshot(
  snapshot: SolicitacaoPaymentSnapshotRecord,
): ResolvedServicePricing {
  if (!snapshot.service_code || !snapshot.price_source) {
    throw new AppError({
      status: 409,
      code: 'SOLICITACAO_PAYMENT_SNAPSHOT_INCOMPLETE',
      message: 'Linked exam request does not have a complete pricing snapshot.',
      details: { solicitacaoExameId: snapshot.id },
    });
  }

  const grossPrice = Number(snapshot.quoted_gross_price || 0);
  const platformFeePercent = Number(snapshot.quoted_platform_fee_percent || 0);
  const platformFeeAmount = Number(snapshot.quoted_platform_fee_amount || 0);
  const professionalNetAmount = Number(snapshot.quoted_professional_net_amount || 0);

  if (grossPrice <= 0) {
    throw new AppError({
      status: 409,
      code: 'SOLICITACAO_PAYMENT_SNAPSHOT_INVALID',
      message: 'Linked exam request has an invalid pricing snapshot.',
      details: { solicitacaoExameId: snapshot.id },
    });
  }

  return {
    serviceCode: snapshot.service_code as ServiceCode,
    priceSource: snapshot.price_source as ResolvedServicePricing['priceSource'],
    feeGroup: getFeeGroupForServiceCode(snapshot.service_code as ServiceCode),
    grossPrice,
    platformFeePercent,
    platformFeeAmount,
    professionalNetAmount,
    pricingRuleId: snapshot.pricing_rule_id || null,
    feeRuleId: snapshot.fee_rule_id || null,
  };
}

function assertLinkedSolicitacaoIsPaid(snapshot: SolicitacaoPaymentSnapshotRecord | null, solicitacaoExameId: string) {
  if (!snapshot?.id) {
    throw new AppError({
      status: 404,
      code: 'SOLICITACAO_EXAME_NOT_FOUND',
      message: 'Linked exam request was not found.',
      details: { solicitacaoExameId },
    });
  }

  if (snapshot.payment_status !== 'paid' || !snapshot.current_payment_charge_id) {
    throw new AppError({
      status: 402,
      code: 'SOLICITACAO_EXAME_PAYMENT_REQUIRED',
      message: 'Linked exam request must be paid before joining the on-duty queue.',
      details: {
        solicitacaoExameId,
        paymentStatus: snapshot.payment_status || '',
      },
    });
  }
}

export async function joinQueue({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: JoinQueueRepository;
} & JoinQueueCommand): Promise<JoinQueueResult> {
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
      message: 'Professional accounts cannot join the patient queue.',
    });
  }

  const activeConsulta = await repository.findActivePlantaoConsultaByPatientId(appUser.id);

  if (activeConsulta?.id) {
    throw new AppError({
      status: 409,
      code: 'ACTIVE_PLANTAO_CONSULTA_EXISTS',
      message: 'Patient already has an active on-duty consultation.',
    });
  }

  const existingEntry = await repository.findCurrentActiveQueueEntry(appUser.id);

  if (existingEntry?.id) {
    return buildQueueResult(existingEntry, true);
  }

  const normalizedSpecialty = normalizePlantaoSpecialty(input.specialty);
  const linkedSolicitacaoSnapshot = input.solicitacaoExameId
    ? await repository.findSolicitacaoPaymentSnapshot({
      solicitacaoExameId: input.solicitacaoExameId,
      patientId: appUser.id,
    })
    : null;
  let serviceCode = getOnDutyServiceCodeForSpecialty(input.specialty);
  let pricing: ResolvedServicePricing | null = null;
  let linkedPaidPayment: {
    currentPaymentChargeId: string;
    paidAt: string | null;
  } | null = null;

  if (input.solicitacaoExameId) {
    assertLinkedSolicitacaoIsPaid(linkedSolicitacaoSnapshot, input.solicitacaoExameId);
    pricing = buildPricingFromSolicitacaoSnapshot(linkedSolicitacaoSnapshot as SolicitacaoPaymentSnapshotRecord);
    serviceCode = pricing.serviceCode;
    linkedPaidPayment = {
      currentPaymentChargeId: linkedSolicitacaoSnapshot?.current_payment_charge_id || '',
      paidAt: linkedSolicitacaoSnapshot?.paid_at || null,
    };
  }

  if (!serviceCode) {
    throw new AppError({
      status: 422,
      code: 'DUTY_SPECIALTY_NOT_PRICED',
      message: 'Selected on-duty specialty is not supported for pricing.',
      details: { specialty: input.specialty, normalizedSpecialty },
    });
  }

  const availableProfiles = await repository.listOnDutyPublicProfiles();
  const hasAvailableProfessionals = availableProfiles.some((profile) =>
    profile.isOnDuty &&
    isApprovedProfessionalStatus(profile.status) &&
    normalizePlantaoSpecialty(profile.specialty) === normalizedSpecialty
  );

  if (!hasAvailableProfessionals) {
    throw new AppError({
      status: 409,
      code: 'NO_ON_DUTY_PROFESSIONAL_AVAILABLE',
      message: 'No professional is currently on duty for the selected specialty.',
    });
  }

  const waitingCount = await repository.countWaitingQueueBySpecialty(input.specialty);
  const position = waitingCount + 1;
  const estimatedWaitTime = position * 10;
  pricing = pricing || await repository.resolveServicePricing({ serviceCode });

  console.info('[join-queue] request:start', {
    requestId,
    patientId: appUser.id,
    specialty: normalizedSpecialty,
    serviceCode,
    position,
  });

  const queueEntry = await repository.createQueueEntry({
    patientId: appUser.id,
    patientName: appUser.fullName,
    patientEmail: appUser.email,
    specialty: input.specialty,
    symptoms: input.symptoms,
    priorityLevel: input.priorityLevel,
    position,
    estimatedWaitTime,
    solicitacaoExameId: input.solicitacaoExameId,
    pricing,
    linkedPaidPayment,
  });

  console.info('[join-queue] request:success', {
    requestId,
    queueId: queueEntry.id,
    patientId: queueEntry.patient_id,
    position: queueEntry.position,
    serviceCode: queueEntry.service_code,
    quotedGrossPrice: queueEntry.quoted_gross_price,
  });

  return buildQueueResult(queueEntry, false);
}
