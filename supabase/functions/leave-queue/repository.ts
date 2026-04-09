import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  AppUserRecord,
  LeaveQueueRepository,
  QueueRecord,
} from './types.ts';

type AppUserRow = {
  id: string;
  auth_user_id: string | null;
  role: string | null;
  is_active: boolean | null;
};

function createLeaveQueueRepository(client: SupabaseClient): LeaveQueueRepository {
  return {
    async findAppUserByAuthUserId(authUserId: string): Promise<AppUserRecord | null> {
      const { data, error } = await client
        .from('app_users')
        .select('id, auth_user_id, role, is_active')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'APP_USER_LOOKUP_FAILED',
          message: 'Unable to load application user.',
          details: error.message,
        });
      }

      const row = data as AppUserRow | null;

      if (!row?.id) {
        return null;
      }

      return {
        id: row.id,
        authUserId: row.auth_user_id || authUserId,
        role: row.role || '',
        isActive: Boolean(row.is_active),
      };
    },

    async findActiveQueueEntry({
      patientId,
      queueId,
    }): Promise<QueueRecord | null> {
      let query = client
        .from('queues')
        .select(`
          id,
          patient_id,
          status,
          specialty,
          position,
          estimated_wait_time,
          assigned_professional_id,
          solicitacao_exame_id
        `)
        .eq('patient_id', patientId)
        .in('status', ['waiting', 'in_progress', 'em_atendimento']);

      if (queueId) {
        query = query.eq('id', queueId);
      } else {
        query = query.order('created_date', { ascending: false }).limit(1);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'QUEUE_LOOKUP_FAILED',
          message: 'Unable to load active queue entry.',
          details: error.message,
        });
      }

      return (data as QueueRecord | null) || null;
    },

    async cancelQueueEntry(queueId: string): Promise<QueueRecord> {
      const { data, error } = await client
        .from('queues')
        .update({ status: 'cancelled' })
        .eq('id', queueId)
        .select(`
          id,
          patient_id,
          status,
          specialty,
          position,
          estimated_wait_time,
          assigned_professional_id,
          solicitacao_exame_id
        `)
        .single();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'QUEUE_CANCEL_FAILED',
          message: 'Unable to leave queue.',
          details: error.message,
        });
      }

      const row = data as QueueRecord | null;

      if (!row?.id) {
        throw new AppError({
          status: 500,
          code: 'INVALID_QUEUE_RESPONSE',
          message: 'Queue cancellation returned an invalid response.',
        });
      }

      return row;
    },
  };
}

export function createLeaveQueueRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createLeaveQueueRepository(client),
  };
}
