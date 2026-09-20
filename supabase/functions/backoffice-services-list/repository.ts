import { AppError } from '../_shared/errors.ts';
import { createServiceRoleClient, type SupabaseClient } from '../_shared/supabase.ts';

type ServicePriceRow = {
  id: string;
  service_code: string;
  specialty_code: string | null;
  display_name: string;
  fee_group: string;
  gross_price: number | string;
  currency: string;
  active: boolean;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeServicePrice(row: ServicePriceRow) {
  return {
    ...row,
    specialty_code: row.specialty_code || '',
    gross_price: Number(row.gross_price),
  };
}

export function createBackofficeServicesListRepository(client: SupabaseClient) {
  return {
    async list() {
      const { data, error } = await client
        .from('platform_service_prices')
        .select('id, service_code, specialty_code, display_name, fee_group, gross_price, currency, active, effective_from, effective_to, created_at, updated_at')
        .order('fee_group', { ascending: true })
        .order('display_name', { ascending: true })
        .order('specialty_code', { ascending: true })
        .order('effective_from', { ascending: false });

      if (error) {
        throw new AppError({
          status: 500,
          code: 'BACKOFFICE_SERVICES_LOOKUP_FAILED',
          message: 'Unable to load platform service prices.',
        });
      }

      return ((data || []) as ServicePriceRow[]).map(normalizeServicePrice);
    },
  };
}

export function createBackofficeServicesListRuntime() {
  const client = createServiceRoleClient();
  return { client, repository: createBackofficeServicesListRepository(client) };
}
