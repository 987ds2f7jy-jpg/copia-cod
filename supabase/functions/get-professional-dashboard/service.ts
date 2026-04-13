import { AppError } from '../_shared/errors.ts';
import type {
  GetProfessionalDashboardCommand,
  GetProfessionalDashboardRepository,
  GetProfessionalDashboardResult,
} from './types.ts';

const SPECIALTY_ALIASES: Record<string, string> = {
  psicologia_clinica: 'psicologia',
};

function normalizeSpecialty(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function normalizePlantaoSpecialty(value: unknown) {
  const normalized = normalizeSpecialty(value);
  return SPECIALTY_ALIASES[normalized] || normalized;
}

export async function getProfessionalDashboard({
  requestId,
  input,
  authenticatedUser,
  appUserId,
  repository,
}: {
  appUserId: string;
  repository: GetProfessionalDashboardRepository;
} & GetProfessionalDashboardCommand): Promise<GetProfessionalDashboardResult> {
  const appointmentsLimit = input.appointmentsLimit ?? 200;
  const includeQueue = input.includeQueue !== false;
  const includeQuestions = input.includeQuestions !== false;
  const includeReviews = input.includeReviews !== false;

  console.info('[get-professional-dashboard] request:start', {
    requestId,
    authUserId: authenticatedUser.authUserId,
    appUserId,
    appointmentsLimit,
    includeQueue,
    includeQuestions,
    includeReviews,
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
  const publicProfile = await repository.findPublicProfileByProfessionalId(professionalId);

  const [availabilitySlots, appointments, queueAll] = await Promise.all([
    repository.listAvailabilitySlots(professionalId),
    repository.listAppointments(visibleProfessionalIds, appointmentsLimit),
    repository.listQueueAll(professionalId, 100),
  ]);

  const specialty = normalizePlantaoSpecialty(professional.specialty);
  const queueWaiting = includeQueue && specialty
    ? await repository.listQueueWaitingBySpecialty({ specialty, limit: 100 })
    : [];

  const [pendingQuestionsBySpecialty, pendingQuestionsAll, answeredQuestions, reviews] = await Promise.all([
    includeQuestions && professional.specialty
      ? repository.listPendingQuestions({ specialty: String(professional.specialty), limit: 50 })
      : Promise.resolve([]),
    includeQuestions ? repository.listPendingQuestionsAll(50) : Promise.resolve([]),
    includeQuestions ? repository.listAnsweredQuestions({ professionalIds: visibleProfessionalIds, limit: 50 }) : Promise.resolve([]),
    includeReviews ? repository.listReviews(visibleProfessionalIds, 100) : Promise.resolve([]),
  ]);

  const mergedPending = [...pendingQuestionsBySpecialty, ...pendingQuestionsAll];
  const seen = new Set<string>();
  const pendingQuestions = mergedPending.filter((q) => {
    const id = String((q as any)?.id || '');
    if (!id) return false;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return {
    professional,
    publicProfile,
    availabilitySlots,
    appointments,
    queueAll,
    queueWaiting,
    pendingQuestions,
    answeredQuestions,
    reviews,
  };
}

