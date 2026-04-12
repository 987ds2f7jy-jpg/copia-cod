import type { AuthenticatedUserLookup } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { requireAppUserByAuthUserId } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import type { ProfessionalIdentityRow } from '../_shared/teleconsulta.ts';
import type {
  ActiveConsultationRow,
  GetMyActiveConsultationRepository,
} from './types.ts';

const ACTIVE_CONSULTATION_STATUSES = ['aguardando', 'em_atendimento', 'in_progress'];
const ACTIVE_CONSULTATION_SELECT = `
  id,
  paciente_id,
  paciente_nome,
  paciente_email,
  profissional_id,
  profissional_user_id,
  profissional_nome,
  especialidade,
  tipo_consulta,
  status,
  datetime,
  descricao_sintomas,
  inicio_at,
  fim_at,
  sala_id,
  token_sala,
  preco,
  created_date
`;

type ProfessionalRow = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  specialty: string | null;
};

function createBaseActiveConsultationQuery(client: SupabaseClient) {
  return client
    .from('consultas')
    .select(ACTIVE_CONSULTATION_SELECT)
    .in('status', ACTIVE_CONSULTATION_STATUSES)
    .order('inicio_at', { ascending: false, nullsFirst: false })
    .order('datetime', { ascending: false, nullsFirst: false })
    .order('created_date', { ascending: false, nullsFirst: false })
    .limit(10);
}

async function runActiveConsultationQuery(query: ReturnType<typeof createBaseActiveConsultationQuery>) {
  const { data, error } = await query;

  if (error) {
    throw new AppError({
      status: 500,
      code: 'ACTIVE_CONSULTATION_LOOKUP_FAILED',
      message: 'Unable to load active telemedicine consultations.',
      details: error.message,
    });
  }

  return (data as ActiveConsultationRow[] | null) || [];
}

function mergeActiveConsultations(groups: ActiveConsultationRow[][]) {
  const merged = new Map<string, ActiveConsultationRow>();

  groups.flat().forEach((row) => {
    if (!row?.id || merged.has(row.id)) {
      return;
    }

    merged.set(row.id, row);
  });

  return Array.from(merged.values());
}

async function listActiveConsultationsByColumn(
  client: SupabaseClient,
  column: string,
  value: string | null | undefined,
) {
  const normalizedValue = String(value ?? '').trim();

  if (!normalizedValue) {
    return [];
  }

  return runActiveConsultationQuery(
    createBaseActiveConsultationQuery(client).eq(column, normalizedValue),
  );
}

function createGetMyActiveConsultationRepository(client: SupabaseClient): GetMyActiveConsultationRepository {
  return {
    async findProfessionalIdentityByAppUserId(appUserId: string): Promise<ProfessionalIdentityRow | null> {
      const { data, error } = await client
        .from('professional_profiles')
        .select('id, user_id, full_name, specialty')
        .eq('user_id', appUserId)
        .order('created_date', { ascending: false })
        .limit(1);

      if (error) {
        throw new AppError({
          status: 500,
          code: 'PROFESSIONAL_IDENTITY_LOOKUP_FAILED',
          message: 'Unable to resolve professional identity.',
          details: error.message,
        });
      }

      const row = (data?.[0] || null) as ProfessionalRow | null;

      if (!row?.id) {
        return null;
      }

      return {
        profileId: row.id,
        appUserId: row.user_id || null,
        fullName: row.full_name || '',
        specialty: row.specialty || '',
        source: 'professional_profiles',
      };
    },

    async listActiveConsultationsForPatient(appUserId: string) {
      return listActiveConsultationsByColumn(client, 'paciente_id', appUserId);
    },

    async listActiveConsultationsForProfessional({ appUserId, professionalProfileId }) {
      return mergeActiveConsultations(await Promise.all([
        listActiveConsultationsByColumn(client, 'profissional_user_id', appUserId),
        listActiveConsultationsByColumn(client, 'profissional_id', appUserId),
        listActiveConsultationsByColumn(client, 'profissional_id', professionalProfileId),
      ]));
    },
  };
}

export function createGetMyActiveConsultationRuntime() {
  const client = createServiceRoleClient();

  return {
    authUserLookup: createSupabaseAuthUserLookup(client) as AuthenticatedUserLookup,
    resolveAppUser(authUserId: string) {
      return requireAppUserByAuthUserId(client, authUserId);
    },
    repository: createGetMyActiveConsultationRepository(client),
  };
}
