import type { InternalPlansRepository } from '../repositories/InternalPlansRepository.ts';

export class ExternalAccessService {
  constructor(private readonly repository: InternalPlansRepository) {}

  syncNutritionAccess(subscriptionId: string) {
    return this.repository.syncExternalAccess(subscriptionId);
  }
}

