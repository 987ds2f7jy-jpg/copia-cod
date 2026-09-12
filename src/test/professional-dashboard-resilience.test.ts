import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../supabase/functions/_shared/errors';
import { getProfessionalDashboard } from '../../supabase/functions/get-professional-dashboard/service';

const professional = {
  id: 'professional-1',
  specialty: 'clinica_geral',
  status: 'approved',
};

function createRepository(overrides: Record<string, unknown> = {}) {
  return {
    findProfessionalByAppUserId: vi.fn().mockResolvedValue(professional),
    listProfessionalIdsByAppUserId: vi.fn().mockResolvedValue([professional.id]),
    findPublicProfileByProfessionalId: vi.fn().mockResolvedValue({ id: 'public-profile-1', status: 'approved' }),
    listAvailabilitySlots: vi.fn().mockResolvedValue([]),
    listAppointments: vi.fn().mockResolvedValue([]),
    listUpcomingAppointmentCandidates: vi.fn().mockResolvedValue([]),
    listQueueAll: vi.fn().mockResolvedValue([]),
    listQueueWaitingBySpecialty: vi.fn().mockResolvedValue([]),
    listPendingQuestions: vi.fn().mockResolvedValue([]),
    listPendingQuestionsAll: vi.fn().mockResolvedValue([]),
    listAnsweredQuestions: vi.fn().mockResolvedValue([]),
    listReviews: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

async function loadDashboard(repository: ReturnType<typeof createRepository>) {
  return getProfessionalDashboard({
    requestId: 'professional-dashboard-test',
    input: { appointmentsLimit: 1, includeQueue: false, includeQuestions: false, includeReviews: false },
    authenticatedUser: { authUserId: 'auth-professional-1', email: null },
    appUserId: 'app-user-1',
    repository: repository as never,
  });
}

describe('professional dashboard resilience', () => {
  it('loads an approved professional with no appointments', async () => {
    await expect(loadDashboard(createRepository())).resolves.toMatchObject({
      professional,
      appointments: [],
      upcomingAppointments: [],
      upcomingAppointmentsError: null,
    });
  });

  it('keeps the profile available when the new upcoming-appointments section fails', async () => {
    const repository = createRepository({
      listUpcomingAppointmentCandidates: vi.fn().mockRejectedValue(new AppError({
        status: 500,
        code: 'UPCOMING_APPOINTMENTS_LOOKUP_FAILED',
        message: 'Unable to load upcoming appointment candidates.',
        details: 'sanitized test detail',
      })),
    });

    await expect(loadDashboard(repository)).resolves.toMatchObject({
      professional,
      upcomingAppointments: [],
      upcomingAppointmentsError: {
        code: 'UPCOMING_APPOINTMENTS_LOOKUP_FAILED',
        message: 'Unable to load upcoming appointments.',
      },
    });
  });

  it('keeps legacy appointments with invalid scheduling data out of expiry filtering without failing the dashboard', async () => {
    const repository = createRepository({
      listUpcomingAppointmentCandidates: vi.fn().mockResolvedValue([{
        id: 'legacy-appointment-1',
        appointment_type: 'PERFIL',
        status: 'accepted',
        scheduled_datetime: null,
        date: null,
        time: null,
      }]),
    });

    await expect(loadDashboard(repository)).resolves.toMatchObject({
      professional,
      upcomingAppointments: [{
        id: 'legacy-appointment-1',
        entry_eligibility: { state: 'invalid_schedule', effectivelyExpired: false },
      }],
      upcomingAppointmentsError: null,
    });
  });
});
