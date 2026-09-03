import type { BackofficeAnalyticsSummary } from '../types';
import { invokeBackofficeFunction } from './client';

export function getBackofficeAnalyticsSummary() {
  return invokeBackofficeFunction<BackofficeAnalyticsSummary>('backoffice-analytics-summary', {});
}
