export type GetFinanceDashboardInput = {
  appointmentsLimit?: number;
  saquesLimit?: number;
};

export type GetFinanceDashboardResult = {
  professional: Record<string, unknown>;
  appointments: Record<string, unknown>[];
  saques: Record<string, unknown>[];
  bankingData: Record<string, unknown> | null;
};

export type GetFinanceDashboardRepository = {
  findProfessionalByAppUserId(appUserId: string): Promise<Record<string, unknown> | null>;
  listProfessionalIdsByAppUserId(appUserId: string): Promise<string[]>;
  listAppointments(professionalIds: string[], limit: number): Promise<Record<string, unknown>[]>;
  listSaques(professionalId: string, limit: number): Promise<Record<string, unknown>[]>;
  getBankingData(professionalId: string): Promise<Record<string, unknown> | null>;
};

export type GetFinanceDashboardCommand = {
  requestId: string;
  input: GetFinanceDashboardInput;
  authenticatedUser: { authUserId: string; email: string | null };
};

