import type { ConsumeInternalPlanCreditInput } from '../../contracts/types.ts';
import type { InternalPlansRepository } from '../repositories/InternalPlansRepository.ts';

export class PlanCreditService {
  constructor(private readonly repository: InternalPlansRepository) {}

  consumeAtomically(input: ConsumeInternalPlanCreditInput) {
    return this.repository.consumePlanCredit(input);
  }

  reconcile(input: {
    usageId: string;
    ownerType: 'appointment' | 'queue';
    ownerId: string;
    requestId: string;
  }) {
    return this.repository.reconcilePlanCredit(input);
  }
}
