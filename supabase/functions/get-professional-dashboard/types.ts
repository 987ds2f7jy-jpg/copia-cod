export type GetProfessionalDashboardInput = {
  appointmentsLimit?: number;
  includeQueue?: boolean;
  includeQuestions?: boolean;
  includeReviews?: boolean;
};

export type GetProfessionalDashboardResult = {
  professional: Record<string, unknown>;
  publicProfile: Record<string, unknown> | null;
  availabilitySlots: Record<string, unknown>[];
  appointments: Record<string, unknown>[];
  queueAll: Record<string, unknown>[];
  queueWaiting: Record<string, unknown>[];
  pendingQuestions: Record<string, unknown>[];
  answeredQuestions: Record<string, unknown>[];
  reviews: Record<string, unknown>[];
};

export type GetProfessionalDashboardRepository = {
  findProfessionalByAppUserId(appUserId: string): Promise<Record<string, unknown> | null>;
  findPublicProfileByProfessionalId(professionalId: string): Promise<Record<string, unknown> | null>;
  listAvailabilitySlots(professionalId: string): Promise<Record<string, unknown>[]>;
  listAppointments(professionalId: string, limit: number): Promise<Record<string, unknown>[]>;
  listQueueAll(professionalId: string, limit: number): Promise<Record<string, unknown>[]>;
  listQueueWaitingBySpecialty(params: { specialty: string; limit: number }): Promise<Record<string, unknown>[]>;
  listPendingQuestions(params: { specialty: string; limit: number }): Promise<Record<string, unknown>[]>;
  listPendingQuestionsAll(limit: number): Promise<Record<string, unknown>[]>;
  listAnsweredQuestions(params: { professionalId: string; limit: number }): Promise<Record<string, unknown>[]>;
  listReviews(professionalId: string, limit: number): Promise<Record<string, unknown>[]>;
};

export type GetProfessionalDashboardCommand = {
  requestId: string;
  input: GetProfessionalDashboardInput;
  authenticatedUser: { authUserId: string; email: string | null };
};

