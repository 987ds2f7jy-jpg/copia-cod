import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  AppUserRecord,
  DeactivateAccountRepository,
} from './types.ts';
import { insertAuditEvent } from '../_shared/observability.ts';

type AppUserRow = {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
  phone: string | null;
  cpf: string | null;
  birth_date: string | null;
  sex: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  profile_complete: boolean | null;
};

function mapAppUserRow(row: AppUserRow): AppUserRecord {
  return {
    id: row.id,
    authUserId: row.auth_user_id || '',
    fullName: row.full_name || '',
    email: row.email || '',
    role: row.role || 'patient',
    isActive: Boolean(row.is_active),
    phone: row.phone || '',
    cpf: row.cpf || '',
    birthDate: row.birth_date || '',
    sex: row.sex || '',
    address: row.address || '',
    city: row.city || '',
    state: row.state || '',
    profileComplete: Boolean(row.profile_complete),
  };
}

function createDeactivateAccountRepository(client: SupabaseClient): DeactivateAccountRepository {
  return {
    async findAppUserByAuthUserId(authUserId) {
      const { data, error } = await client
        .from('app_users')
        .select('id, auth_user_id, full_name, email, role, is_active, phone, cpf, birth_date, sex, address, city, state, profile_complete')
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
      return row?.id ? mapAppUserRow(row) : null;
    },

    async hasActiveCareRelationship(appUser) {
      const activeAppointmentStatuses = ['SOLICITADO', 'requested', 'pending', 'CONFIRMADO', 'accepted', 'confirmed', 'in_progress', 'em_atendimento'];
      const activeConsultationStatuses = ['aguardando', 'em_atendimento'];
      const activeQueueStatuses = ['waiting', 'in_progress', 'em_atendimento'];

      if (appUser.role === 'patient') {
        const [appointments, consultations, queues] = await Promise.all([
          client.from('appointments').select('id', { count: 'exact', head: true }).eq('patient_id', appUser.id).in('status', activeAppointmentStatuses),
          client.from('consultas').select('id', { count: 'exact', head: true }).eq('paciente_id', appUser.id).in('status', activeConsultationStatuses),
          client.from('queues').select('id', { count: 'exact', head: true }).eq('patient_id', appUser.id).in('status', activeQueueStatuses),
        ]);
        const failed = [appointments, consultations, queues].find((result) => result.error);
        if (failed?.error) throw new AppError({ status: 500, code: 'ACCOUNT_RELATIONSHIP_CHECK_FAILED', message: 'Unable to validate active care relationships.' });
        return [appointments, consultations, queues].some((result) => (result.count || 0) > 0);
      }

      if (appUser.role === 'professional') {
        const { data: profiles, error: profileError } = await client.from('professional_profiles').select('id').eq('user_id', appUser.id);
        const { data: publicProfiles, error: publicProfileError } = await client.from('professional_public_profiles').select('id').eq('user_id', appUser.id);
        if (profileError || publicProfileError) throw new AppError({ status: 500, code: 'ACCOUNT_RELATIONSHIP_CHECK_FAILED', message: 'Unable to validate professional relationships.' });
        const professionalIds = [...(profiles || []), ...(publicProfiles || [])].map((profile) => String(profile.id));
        const consultationQuery = client.from('consultas').select('id', { count: 'exact', head: true }).eq('profissional_user_id', appUser.id).in('status', activeConsultationStatuses);
        const appointmentQuery = professionalIds.length > 0
          ? client.from('appointments').select('id', { count: 'exact', head: true }).in('professional_id', professionalIds).in('status', activeAppointmentStatuses)
          : Promise.resolve({ count: 0, error: null });
        const queueQuery = professionalIds.length > 0
          ? client.from('queues').select('id', { count: 'exact', head: true }).in('assigned_professional_id', professionalIds).in('status', activeQueueStatuses)
          : Promise.resolve({ count: 0, error: null });
        const [appointments, consultations, queues] = await Promise.all([appointmentQuery, consultationQuery, queueQuery]);
        if (appointments.error || consultations.error || queues.error) throw new AppError({ status: 500, code: 'ACCOUNT_RELATIONSHIP_CHECK_FAILED', message: 'Unable to validate professional relationships.' });
        return [appointments, consultations, queues].some((result) => (result.count || 0) > 0);
      }

      return false;
    },

    async deactivateAppUser(appUserId) {
      const { data, error } = await client
        .from('app_users')
        .update({
          is_active: false,
          deactivated_at: new Date().toISOString(),
          deactivation_reason_code: 'user_requested',
        })
        .eq('id', appUserId)
        .select('id, auth_user_id, full_name, email, role, is_active, phone, cpf, birth_date, sex, address, city, state, profile_complete')
        .single();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'APP_USER_DEACTIVATE_FAILED',
          message: 'Unable to deactivate application user.',
          details: error.message,
        });
      }

      return mapAppUserRow(data as AppUserRow);
    },

    async disableProfessionalDuty(appUserId) {
      const { error } = await client.from('professional_profiles').update({ is_on_duty: false }).eq('user_id', appUserId);
      if (error) throw new AppError({ status: 500, code: 'PROFESSIONAL_DUTY_DISABLE_FAILED', message: 'Unable to disable professional duty before account deactivation.' });
      const { error: publicError } = await client.from('professional_public_profiles').update({ is_on_duty: false }).eq('user_id', appUserId);
      if (publicError) throw new AppError({ status: 500, code: 'PROFESSIONAL_DUTY_DISABLE_FAILED', message: 'Unable to disable professional duty before account deactivation.' });
    },

    async writeAudit({ appUser, requestId }) {
      await insertAuditEvent(client, {
        actorUserId: appUser.id,
        actorRole: appUser.role as 'patient' | 'professional' | 'admin',
        action: 'account.deactivated',
        resourceType: 'app_user',
        resourceId: appUser.id,
        outcome: 'succeeded',
        requestId,
        metadata: { reason_code: 'user_requested' },
      });
    },

    async revokeAccessToken(accessToken) {
      const { error } = await client.auth.admin.signOut(accessToken, 'global');

      if (error) {
        throw new AppError({
          status: 500,
          code: 'AUTH_SESSION_INVALIDATION_FAILED',
          message: 'Unable to invalidate user sessions.',
          details: error.message,
        });
      }
    },
  };
}

export function createDeactivateAccountRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createDeactivateAccountRepository(client),
  };
}
