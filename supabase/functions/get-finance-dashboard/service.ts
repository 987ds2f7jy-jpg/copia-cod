import { AppError } from '../_shared/errors.ts';
import type {
  GetFinanceDashboardCommand,
  GetFinanceDashboardRepository,
  GetFinanceDashboardResult,
} from './types.ts';

export async function getFinanceDashboard({
  requestId,
  input,
  authenticatedUser,
  appUserId,
  repository,
}: {
  appUserId: string;
  repository: GetFinanceDashboardRepository;
} & GetFinanceDashboardCommand): Promise<GetFinanceDashboardResult> {
  const appointmentsLimit = input.appointmentsLimit ?? 500;
  const saquesLimit = input.saquesLimit ?? 50;

  console.info('[get-finance-dashboard] request:start', {
    requestId,
    authUserId: authenticatedUser.authUserId,
    appUserId,
    appointmentsLimit,
    saquesLimit,
  });

  const professional = await repository.findProfessionalByAppUserId(appUserId);

  if (!professional?.id) {
    throw new AppError({
      status: 404,
      code: 'PROFESSIONAL_PROFILE_NOT_FOUND',
      message: 'Professional profile not found.',
    });
  }

  const professionalId = String(professional.id);
  const professionalIds = await repository.listProfessionalIdsByAppUserId(appUserId);
  const visibleProfessionalIds = professionalIds.length > 0 ? professionalIds : [professionalId];
  const [appointments, serviceRequests, saques, bankingData] = await Promise.all([
    repository.listAppointments(visibleProfessionalIds, appointmentsLimit),
    repository.listCompletedServiceRequests(visibleProfessionalIds, appointmentsLimit),
    repository.listSaques(professionalId, saquesLimit),
    repository.getBankingData(professionalId),
  ]);

  const appointmentConsultaIds = new Set(
    appointments
      .map((appointment) => String(appointment?.consulta_id || '').trim())
      .filter(Boolean),
  );
  const visibleServiceRequests = serviceRequests.filter((request) => {
    const consultaId = String(request?.consulta_id || '').trim();
    return !consultaId || !appointmentConsultaIds.has(consultaId);
  });

  return {
    professional,
    appointments,
    serviceRequests: visibleServiceRequests,
    saques,
    bankingData,
  };
}

