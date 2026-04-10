export type RequestWithdrawalInput = {
  value: number;
  pixKey?: string | null;
};

export type RequestWithdrawalResult = {
  saque: Record<string, unknown>;
  saldoDisponivel: number;
};

export type RequestWithdrawalRepository = {
  findProfessionalByAppUserId(appUserId: string): Promise<{ id: string } | null>;
  listCompletedAppointmentsForMonth(params: { professionalId: string; monthStart: string; monthEnd: string }): Promise<Array<{ price: number | null; preco: number | null; status: string | null; date: string | null }>>;
  listPaidSaques(professionalId: string): Promise<Array<{ valor: number | null }>>;
  getBankingData(professionalId: string): Promise<Record<string, unknown> | null>;
  createSaque(params: { professionalId: string; valor: number; metodo: string; observacao: string }): Promise<Record<string, unknown>>;
};

export type RequestWithdrawalCommand = {
  requestId: string;
  input: RequestWithdrawalInput;
  authenticatedUser: { authUserId: string; email: string | null };
};

