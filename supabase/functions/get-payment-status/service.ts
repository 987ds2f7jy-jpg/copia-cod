import { AppError } from '../_shared/errors.ts';
import type {
  GetPaymentStatusCommand,
  GetPaymentStatusRepository,
  GetPaymentStatusResult,
  PaymentOwnerRecord,
  PaymentOwnerType,
} from './types.ts';

const APPOINTMENT_RELEASED_STATUSES = new Set(['accepted', 'confirmed', 'CONFIRMADO', 'in_progress', 'em_atendimento', 'completed', 'CONCLUIDO']);
const QUEUE_RELEASED_STATUSES = new Set(['waiting', 'assigned', 'in_progress', 'em_atendimento', 'completed']);
const SOLICITACAO_RELEASED_STATUSES = new Set(['pending', 'in_progress', 'completed']);

function isServiceReleased(
  ownerType: PaymentOwnerType,
  owner: PaymentOwnerRecord,
  chargeId: string,
  chargeStatus: string,
) {
  const paymentConfirmed = chargeStatus === 'paid'
    && owner.paymentStatus === 'paid'
    && owner.currentPaymentChargeId === chargeId;

  if (!paymentConfirmed) {
    return false;
  }

  if (ownerType === 'appointment') {
    return Boolean(owner.consultaId) && APPOINTMENT_RELEASED_STATUSES.has(owner.operationalStatus);
  }

  if (ownerType === 'queue') {
    return QUEUE_RELEASED_STATUSES.has(owner.operationalStatus);
  }

  if (ownerType === 'solicitacao_exame') {
    return SOLICITACAO_RELEASED_STATUSES.has(owner.operationalStatus);
  }

  return owner.operationalStatus === 'active';
}

export async function getPaymentStatus({
  input,
  authenticatedUser,
  repository,
}: {
  repository: GetPaymentStatusRepository;
} & GetPaymentStatusCommand): Promise<GetPaymentStatusResult> {
  const appUser = await repository.findAppUserByAuthUserId(authenticatedUser.authUserId);

  if (!appUser?.id || appUser.isActive === false) {
    throw new AppError({
      status: 403,
      code: 'APP_USER_NOT_AUTHORIZED',
      message: 'Authenticated user is not allowed to access payment status.',
    });
  }

  if (appUser.role !== 'patient') {
    throw new AppError({
      status: 403,
      code: 'PATIENT_ROLE_REQUIRED',
      message: 'Only patients can access their payment status.',
    });
  }

  const charge = await repository.findPaymentChargeById(input.chargeId);

  if (!charge?.id) {
    throw new AppError({
      status: 404,
      code: 'PAYMENT_CHARGE_NOT_FOUND',
      message: 'Payment charge was not found.',
    });
  }

  const owner = await repository.findPaymentOwner(charge);

  if (!owner?.id) {
    throw new AppError({
      status: 404,
      code: 'PAYMENT_OWNER_NOT_FOUND',
      message: 'Payment resource was not found.',
    });
  }

  if (owner.patientId !== appUser.id) {
    throw new AppError({
      status: 403,
      code: 'PAYMENT_CHARGE_FORBIDDEN',
      message: 'Payment charge does not belong to the authenticated patient.',
    });
  }

  return {
    chargeId: charge.id,
    ownerType: charge.ownerType,
    ownerId: charge.ownerId,
    status: charge.status,
    serviceReleased: isServiceReleased(charge.ownerType, owner, charge.id, charge.status),
    updatedAt: charge.updatedAt,
  };
}
