import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../supabase/functions/_shared/errors';
import { requireActiveBackofficeAdmin } from '../../supabase/functions/_shared/backofficeAuth';
import { handleBackofficePreflight } from '../../supabase/functions/_shared/backofficeCors';
import { listBackofficeServices } from '../../supabase/functions/backoffice-services-list/service';
import { parseBackofficeServicesListInput } from '../../supabase/functions/backoffice-services-list/validation';
import { updateBackofficeService } from '../../supabase/functions/backoffice-services-update/service';
import { parseBackofficeServicesUpdateInput } from '../../supabase/functions/backoffice-services-update/validation';

vi.mock('../../supabase/functions/_shared/backofficeAuth', () => ({
  requireActiveBackofficeAdmin: vi.fn(),
}));

const adminUserId = '20000000-0000-4000-8000-000000000001';
const servicePriceId = '30000000-0000-4000-8000-000000000001';

function adminRequest() {
  return new Request('https://example.test/functions/v1/backoffice-services', {
    method: 'POST',
    headers: { Authorization: 'Bearer administrative-token' },
  });
}

function expectAppError(action: () => unknown, expected: { status: number; code: string }) {
  try {
    action();
  } catch (error) {
    expect(error).toMatchObject(expected);
    return;
  }
  throw new Error(`Expected ${expected.code} to be thrown.`);
}

describe('backoffice services management', () => {
  beforeEach(() => {
    vi.mocked(requireActiveBackofficeAdmin).mockReset();
    vi.mocked(requireActiveBackofficeAdmin).mockResolvedValue({ id: adminUserId, email: 'admin@example.test' });
  });

  it('allows an active admin to list service prices', async () => {
    expect(parseBackofficeServicesListInput({})).toEqual({});
    const services = [{ id: servicePriceId, gross_price: 120, active: true }];
    const repository = { list: vi.fn().mockResolvedValue(services) };

    await expect(listBackofficeServices({
      req: adminRequest(),
      client: {} as never,
      repository: repository as never,
    })).resolves.toEqual({ services });
    expect(repository.list).toHaveBeenCalledOnce();
  });

  it('rejects a normal or invalid token before listing service prices', async () => {
    vi.mocked(requireActiveBackofficeAdmin).mockRejectedValueOnce(new AppError({
      status: 401,
      code: 'ADMIN_TOKEN_INVALID',
      message: 'Invalid administrative session.',
    }));
    const repository = { list: vi.fn() };

    await expect(listBackofficeServices({
      req: adminRequest(),
      client: {} as never,
      repository: repository as never,
    })).rejects.toMatchObject({ status: 401, code: 'ADMIN_TOKEN_INVALID' });
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('forwards only the validated price and activation fields for an admin update', async () => {
    const input = parseBackofficeServicesUpdateInput({
      servicePriceId,
      grossPrice: 149.9,
      active: true,
    });
    const updated = { id: servicePriceId, gross_price: 149.9, active: true };
    const repository = { update: vi.fn().mockResolvedValue(updated) };

    await expect(updateBackofficeService({
      req: adminRequest(),
      client: {} as never,
      repository: repository as never,
      input,
      requestId: 'request-service-update-1',
    })).resolves.toEqual({ service: updated });
    expect(repository.update).toHaveBeenCalledWith({
      servicePriceId,
      grossPrice: 149.9,
      active: true,
      adminUserId,
      requestId: 'request-service-update-1',
    });
  });

  it.each([true, false])('supports changing active to %s', async (active) => {
    const repository = { update: vi.fn().mockResolvedValue({ id: servicePriceId, active }) };
    await updateBackofficeService({
      req: adminRequest(),
      client: {} as never,
      repository: repository as never,
      input: { servicePriceId, grossPrice: 100, active },
      requestId: 'request-service-active',
    });
    expect(repository.update).toHaveBeenCalledWith(expect.objectContaining({ active }));
  });

  it('rejects negative prices and values with more than two decimal places', () => {
    expectAppError(
      () => parseBackofficeServicesUpdateInput({ servicePriceId, grossPrice: -0.01, active: true }),
      { status: 400, code: 'SERVICE_PRICE_VALUE_INVALID' },
    );
    expectAppError(
      () => parseBackofficeServicesUpdateInput({ servicePriceId, grossPrice: 1.001, active: true }),
      { status: 400, code: 'SERVICE_PRICE_VALUE_INVALID' },
    );
  });

  it('rejects unknown IDs returned by the transactional repository', async () => {
    const repository = {
      update: vi.fn().mockRejectedValue(new AppError({
        status: 404,
        code: 'SERVICE_PRICE_NOT_FOUND',
        message: 'Service price was not found.',
      })),
    };

    await expect(updateBackofficeService({
      req: adminRequest(),
      client: {} as never,
      repository: repository as never,
      input: { servicePriceId, grossPrice: 100, active: true },
      requestId: 'request-service-not-found',
    })).rejects.toMatchObject({ status: 404, code: 'SERVICE_PRICE_NOT_FOUND' });
  });

  it('does not update without a valid admin token', async () => {
    vi.mocked(requireActiveBackofficeAdmin).mockRejectedValueOnce(new AppError({
      status: 401,
      code: 'ADMIN_AUTHORIZATION_REQUIRED',
      message: 'Administrative authorization is required.',
    }));
    const repository = { update: vi.fn() };

    await expect(updateBackofficeService({
      req: adminRequest(),
      client: {} as never,
      repository: repository as never,
      input: { servicePriceId, grossPrice: 100, active: true },
      requestId: 'request-service-unauthorized',
    })).rejects.toMatchObject({ status: 401, code: 'ADMIN_AUTHORIZATION_REQUIRED' });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects fields outside the update allowlist', () => {
    expectAppError(
      () => parseBackofficeServicesUpdateInput({
        servicePriceId,
        grossPrice: 100,
        active: true,
        currency: 'USD',
      }),
      { status: 400, code: 'SERVICE_PRICE_FIELDS_INVALID' },
    );
  });

  it('handles CORS preflight without authentication and both handlers do it first', () => {
    const response = handleBackofficePreflight(new Request('https://example.test', { method: 'OPTIONS' }));
    expect(response?.status).toBe(204);

    for (const path of [
      'supabase/functions/backoffice-services-list/handler.ts',
      'supabase/functions/backoffice-services-update/handler.ts',
    ]) {
      const handler = readFileSync(resolve(process.cwd(), path), 'utf8');
      expect(handler.indexOf('handleBackofficePreflight(req)')).toBeLessThan(handler.indexOf('createRequestId()'));
      expect(handler.indexOf('handleBackofficePreflight(req)')).toBeLessThan(handler.indexOf('readJsonBody(req)'));
    }
  });

  it('updates and audits atomically with an update-only allowlist', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260915120000_create_backoffice_service_price_update_rpc.sql'),
      'utf8',
    );
    const repository = readFileSync(
      resolve(process.cwd(), 'supabase/functions/backoffice-services-update/repository.ts'),
      'utf8',
    );

    expect(migration).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/);
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain('SET gross_price = p_gross_price');
    expect(migration).toContain('active = p_active');
    expect(migration).toContain('INSERT INTO public.backoffice_audit_events');
    expect(migration).toContain("'platform_service_prices'");
    expect(migration).toContain("'service_price.activated'");
    expect(migration).toContain("'service_price.deactivated'");
    expect(repository).toContain("client.rpc('update_backoffice_service_price'");
    expect(repository).not.toContain('.from(\'platform_service_prices\').update');
  });
});
