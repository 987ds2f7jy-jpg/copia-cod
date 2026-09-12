import { AppError } from '../_shared/errors.ts';
import { createServiceRoleClient, type SupabaseClient } from '../_shared/supabase.ts';
import type { ExpirationDryRunRecord } from './types.ts';

export function createExpirationWorkerRepository(client: SupabaseClient = createServiceRoleClient()) {
  return {
    async dryRun(params: { limit: number; rolloutCutoff: string | null }) {
      const { data, error } = await client.rpc('scheduled_consultation_expiration_dry_run', {
        p_limit: params.limit,
        p_rollout_cutoff: params.rolloutCutoff,
      });
      if (error) {
        throw new AppError({ status: 500, code: 'SCHEDULED_EXPIRATION_DRY_RUN_FAILED', message: 'Unable to prepare scheduled consultation expiration dry run.' });
      }
      return (data || []) as ExpirationDryRunRecord[];
    },
    async expire(params: { limit: number; rolloutCutoff: string }) {
      const { data, error } = await client.rpc('expire_overdue_scheduled_consultations', {
        p_limit: params.limit,
        p_rollout_cutoff: params.rolloutCutoff,
      });
      if (error) {
        throw new AppError({ status: 500, code: 'SCHEDULED_EXPIRATION_WORKER_FAILED', message: 'Unable to expire overdue scheduled consultations.' });
      }
      const row = Array.isArray(data) ? data[0] : data;
      return {
        processed: Number(row?.processed || 0),
        skipped: Number(row?.skipped || 0),
        inconsistent: Number(row?.inconsistent || 0),
        failed: Number(row?.failed || 0),
      };
    },
  };
}
