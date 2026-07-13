import type { AppUser } from '../_shared/professional.ts';
import type { AuthenticatedUser } from '../_shared/types.ts';

export type ReconciliationQueueInput = {
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

export type ReconciliationIssueRow = {
  issue_type: string;
  severity: string;
  owner_type: string;
  owner_id: string | null;
  status: string;
  resource_status: string;
  reason_code: string;
  source_updated_at: string;
  payment_charge_id: string | null;
  plan_credit_usage_id: string | null;
  provider: string | null;
};

export type ReconciliationQueueRepository = {
  list(input: ReconciliationQueueInput): Promise<{
    rows: ReconciliationIssueRow[];
    total: number;
  }>;
  writeAccessAudit(input: {
    admin: AppUser;
    requestId: string;
  }): Promise<void>;
};

export type ReconciliationQueueCommand = {
  requestId: string;
  input: ReconciliationQueueInput;
  authenticatedUser: AuthenticatedUser;
  admin: AppUser;
};
