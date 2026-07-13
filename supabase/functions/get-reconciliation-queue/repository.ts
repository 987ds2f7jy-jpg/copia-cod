import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { insertAuditEvent } from '../_shared/observability.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  ReconciliationIssueRow,
  ReconciliationQueueInput,
  ReconciliationQueueRepository,
} from './types.ts';

export function createReconciliationQueueRepository(client: SupabaseClient): ReconciliationQueueRepository {
  return {
    async list(input: ReconciliationQueueInput) {
      const offset = (input.page - 1) * input.pageSize;
      let query = client
        .from('system_reconciliation_queue')
        .select(`
          issue_type,
          severity,
          owner_type,
          owner_id,
          status,
          resource_status,
          reason_code,
          source_updated_at,
          payment_charge_id,
          plan_credit_usage_id,
          provider
        `, { count: 'exact' })
        .order('source_updated_at', { ascending: true })
        .range(offset, offset + input.pageSize - 1);

      if (input.type) query = query.eq('issue_type', input.type);
      if (input.status) query = query.eq('status', input.status);
      if (input.from) query = query.gte('source_updated_at', input.from);
      if (input.to) query = query.lte('source_updated_at', input.to);

      const { data, error, count } = await query;

      if (error) {
        throw new AppError({
          status: 500,
          code: 'RECONCILIATION_QUEUE_LOAD_FAILED',
          message: 'Unable to load reconciliation items.',
        });
      }

      return {
        rows: (data as ReconciliationIssueRow[] | null) || [],
        total: count || 0,
      };
    },
    async writeAccessAudit({ admin, requestId }) {
      await insertAuditEvent(client, {
        actorUserId: admin.id,
        actorRole: admin.role,
        action: 'reconciliation_queue.accessed',
        resourceType: 'reconciliation_queue',
        outcome: 'succeeded',
        requestId,
      });
    },
  };
}

export function createGetReconciliationQueueRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    async resolveAdmin(authUserId: string) {
      const appUser = await requireAppUserByAuthUserId(client, authUserId);
      requireRole(appUser, ['admin']);
      return appUser;
    },
    repository: createReconciliationQueueRepository(client),
  };
}
