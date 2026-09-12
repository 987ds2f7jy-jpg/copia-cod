export type ExpirationWorkerInput = {
  dryRun: boolean;
  limit: number;
};

export type ExpirationDryRunRecord = {
  consultation_id: string;
  classification: string;
  linked_appointment_count: number;
  deadline_at: string | null;
};
