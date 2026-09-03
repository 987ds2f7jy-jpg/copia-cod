export type BackofficeAdmin = {
  id: string;
  email: string;
};

export type BackofficeSession = {
  accessToken: string;
  expiresAt: number;
  admin: BackofficeAdmin;
};

export type PendingProfessional = {
  id: string;
  full_name: string;
  profession: string;
  specialty: string;
  register_number: string;
  register_state: string;
  phone: string;
  cpf: string;
  created_date: string;
  status: 'pending';
};

export type BackofficeAnalyticsSummary = {
  totalProfessionals: number;
  totalUsers: number;
  totalCompletedConsultations: number;
};
