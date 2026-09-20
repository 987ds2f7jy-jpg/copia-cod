import type { BackofficeServicePrice } from '../types';
import { invokeBackofficeFunction } from './client';

export function getBackofficeServices() {
  return invokeBackofficeFunction<{ services: BackofficeServicePrice[] }>('backoffice-services-list', {});
}

export function updateBackofficeService(input: {
  servicePriceId: string;
  grossPrice: number;
  active: boolean;
}) {
  return invokeBackofficeFunction<{ service: BackofficeServicePrice }>('backoffice-services-update', input);
}
