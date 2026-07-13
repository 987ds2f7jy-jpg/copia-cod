import type { AppUser } from '../_shared/professional.ts';
import type { AuthenticatedUser } from '../_shared/types.ts';

export type ReconciliationOwnerType = 'appointment' | 'queue' | 'solicitacao_exame' | 'plan_subscription';

export type ReconcileFinancialOwnerInput = {
  ownerType: ReconciliationOwnerType;
  ownerId: string;
};

export type ReconciliationIssue = {
  issue_type: string;
  reason_code: string;
};

export type ReconciliationStepResult = {
  attempted: boolean;
  changed: boolean;
  status: 'skipped' | 'resolved' | 'manual_review_required';
  reasonCode: string;
};

export type ReconcileFinancialOwnerRepository = {
  acquireClaim(input: {
    ownerType: ReconciliationOwnerType;
    ownerId: string;
    requestId: string;
    actorUserId: string;
  }): Promise<boolean>;
  releaseClaim(input: {
    ownerType: ReconciliationOwnerType;
    ownerId: string;
    requestId: string;
  }): Promise<void>;
  listIssues(ownerType: ReconciliationOwnerType, ownerId: string): Promise<ReconciliationIssue[]>;
  reconcilePayment(ownerType: ReconciliationOwnerType, ownerId: string): Promise<ReconciliationStepResult>;
  reconcilePlanCredit(
    ownerType: ReconciliationOwnerType,
    ownerId: string,
    requestId: string,
  ): Promise<ReconciliationStepResult>;
  writeAudit(input: {
    admin: AppUser;
    requestId: string;
    ownerType: ReconciliationOwnerType;
    ownerId: string;
    outcome: 'started' | 'resolved' | 'failed' | 'manual_review_required';
    errorCode?: string | null;
    issueType?: string | null;
  }): Promise<void>;
};

export type ReconcileFinancialOwnerCommand = {
  requestId: string;
  input: ReconcileFinancialOwnerInput;
  authenticatedUser: AuthenticatedUser;
  admin: AppUser;
};
