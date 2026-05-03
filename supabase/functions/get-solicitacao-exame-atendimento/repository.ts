import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type {
  GetSolicitacaoExameAtendimentoRepository,
  PatientSummary,
  ProfessionalIdentity,
  SolicitacaoExameAtendimentoRecord,
} from './types.ts';

type AppUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
  sex: string | null;
  birth_date: string | null;
};

type ProfessionalProfileRow = {
  id: string;
  user_id: string | null;
};

const SOLICITACAO_SELECT = `
  id,
  paciente_id,
  paciente_nome,
  paciente_email,
  paciente_telefone,
  tipo,
  exame_solicitado,
  motivo,
  sintomas,
  status,
  assintomatico_confirmado,
  medico_id,
  fluxo_destino,
  especialidade_destino,
  nome_medicamento,
  dosagem,
  frequencia,
  arquivo_receita_url,
  dados_identificacao,
  informacoes_saude,
  dados_saude,
  especificacao_laudo,
  arquivos,
  arquivos_urls,
  queue_id,
  service_code,
  price_source,
  quoted_gross_price,
  quoted_platform_fee_percent,
  quoted_platform_fee_amount,
  quoted_professional_net_amount,
  pricing_rule_id,
  fee_rule_id,
  payment_status,
  current_payment_charge_id,
  accepted_at,
  created_date,
  updated_at
`;

function mapPatient(row: AppUserRow | null): PatientSummary | null {
  if (!row?.id) {
    return null;
  }

  return {
    id: row.id,
    fullName: row.full_name || '',
    email: row.email || '',
    phone: row.phone || '',
    sex: row.sex || '',
    birthDate: row.birth_date || '',
  };
}

function createGetSolicitacaoExameAtendimentoRepository(
  client: SupabaseClient,
): GetSolicitacaoExameAtendimentoRepository {
  return {
    async findProfessionalIdentityByAuthUserId(authUserId: string): Promise<ProfessionalIdentity | null> {
      const { data: appUserData, error: appUserError } = await client
        .from('app_users')
        .select('id, full_name, email, phone, role, is_active, sex, birth_date')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (appUserError) {
        throw new AppError({
          status: 500,
          code: 'APP_USER_LOOKUP_FAILED',
          message: 'Unable to load application user.',
          details: appUserError.message,
        });
      }

      const appUser = appUserData as AppUserRow | null;

      if (!appUser?.id) {
        throw new AppError({
          status: 403,
          code: 'APP_USER_NOT_FOUND',
          message: 'Authenticated user is not linked to app_users.',
        });
      }

      if (appUser.is_active === false) {
        throw new AppError({
          status: 403,
          code: 'ACCOUNT_INACTIVE',
          message: 'Authenticated account is inactive.',
        });
      }

      if (String(appUser.role || '').trim() !== 'professional') {
        throw new AppError({
          status: 403,
          code: 'PROFESSIONAL_ROLE_REQUIRED',
          message: 'Only professionals can access service request attendance.',
        });
      }

      const { data: profilesData, error: profilesError } = await client
        .from('professional_profiles')
        .select('id, user_id')
        .eq('user_id', appUser.id)
        .order('created_date', { ascending: false });

      if (profilesError) {
        throw new AppError({
          status: 500,
          code: 'PROFESSIONAL_PROFILE_LOOKUP_FAILED',
          message: 'Unable to resolve professional profile.',
          details: profilesError.message,
        });
      }

      const profileIds = ((profilesData as ProfessionalProfileRow[] | null) || [])
        .map((profile) => profile.id)
        .filter(Boolean);

      if (profileIds.length === 0) {
        throw new AppError({
          status: 403,
          code: 'PROFESSIONAL_PROFILE_NOT_FOUND',
          message: 'No professional profile was found for this user.',
        });
      }

      return {
        appUserId: appUser.id,
        profileIds,
        primaryProfileId: profileIds[0],
      };
    },

    async findSolicitacaoExameById(solicitacaoId: string): Promise<SolicitacaoExameAtendimentoRecord | null> {
      const { data, error } = await client
        .from('solicitacoes_exames')
        .select(SOLICITACAO_SELECT)
        .eq('id', solicitacaoId)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'SOLICITACAO_EXAME_LOOKUP_FAILED',
          message: 'Unable to load exam/service request.',
          details: error.message,
        });
      }

      return (data as SolicitacaoExameAtendimentoRecord | null) || null;
    },

    async findPatientById(patientId: string): Promise<PatientSummary | null> {
      if (!patientId) {
        return null;
      }

      const { data, error } = await client
        .from('app_users')
        .select('id, full_name, email, phone, role, is_active, sex, birth_date')
        .eq('id', patientId)
        .maybeSingle();

      if (error) {
        throw new AppError({
          status: 500,
          code: 'PATIENT_LOOKUP_FAILED',
          message: 'Unable to load patient data.',
          details: error.message,
        });
      }

      return mapPatient(data as AppUserRow | null);
    },
  };
}

export function createGetSolicitacaoExameAtendimentoRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    repository: createGetSolicitacaoExameAtendimentoRepository(client),
  };
}
