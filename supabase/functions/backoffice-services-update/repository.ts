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

function mapRpcError(message = '') {
  if (message.includes('SERVICE_PRICE_NOT_FOUND')) {
    return new AppError({ status: 404, code: 'SERVICE_PRICE_NOT_FOUND', message: 'Service price was not found.' });
  }
  if (message.includes('SERVICE_PRICE_NO_CHANGES')) {
    return new AppError({ status: 409, code: 'SERVICE_PRICE_NO_CHANGES', message: 'Service price has no changes to apply.' });
  }
  if (message.includes('SERVICE_PRICE_UPDATE_INVALID')) {
    return new AppError({ status: 400, code: 'SERVICE_PRICE_UPDATE_INVALID', message: 'Service price update is invalid.' });
  }
  return new AppError({ status: 500, code: 'SERVICE_PRICE_UPDATE_FAILED', message: 'Unable to update service price.' });
}

export function createBackofficeServicesUpdateRepository(client: SupabaseClient) {
  return {
    async update(input: {
      servicePriceId: string;
      grossPrice: number;
      active: boolean;
      adminUserId: string;
      requestId: string;
    }) {
      const { data, error } = await client.rpc('update_backoffice_service_price', {
        p_service_price_id: input.servicePriceId,
        p_gross_price: input.grossPrice,
        p_active: input.active,
        p_admin_user_id: input.adminUserId,
      });

      if (error) {
        console.error('[backoffice-services-update] rpc:failed', {
          requestId: input.requestId,
          servicePriceId: input.servicePriceId,
          adminUserId: input.adminUserId,
          grossPrice: input.grossPrice,
          active: input.active,
          errorCode: error.code || null,
          errorMessage: error.message || null,
          errorDetails: error.details || null,
          errorHint: error.hint || null,
        });
        throw mapRpcError(error.message);
      }

      const row = (Array.isArray(data) ? data[0] : data) as ServicePriceRow | null;
      if (!row?.id) {
        throw new AppError({
          status: 500,
          code: 'SERVICE_PRICE_UPDATE_FAILED',
          message: 'Unable to update service price.',
        });
      }

      return {
        ...row,
        specialty_code: row.specialty_code || '',
        gross_price: Number(row.gross_price),
      };
    },
  };
}

export function createBackofficeServicesUpdateRuntime() {
  const client = createServiceRoleClient();
  return { client, repository: createBackofficeServicesUpdateRepository(client) };
}
