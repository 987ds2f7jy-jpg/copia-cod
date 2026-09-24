import type { SupabaseClient } from '../supabase.ts';
import type {
  ActivatePlanSubscriptionInput,
  AddFamilyPlanMemberInput,
  ConsumeInternalPlanCreditInput,
  FindAvailableSubscriptionScoreInput,
  ListSubscriptionScoresInput,
  UseSubscriptionScoreInput,
} from './contracts/types.ts';
import { InternalPlansProvider } from './internal/InternalPlansProvider.ts';
import { SupabaseInternalPlansRepository } from './internal/repositories/InternalPlansRepository.ts';
import { PlanCreditService } from './internal/services/PlanCreditService.ts';
import { InternalPlansQueue } from './queue/InternalPlansQueue.ts';

export class PlansFacade {
  readonly provider: InternalPlansProvider;
  private readonly credits: PlanCreditService;
  private readonly queue: InternalPlansQueue;

  constructor(client: SupabaseClient) {
    const repository = new SupabaseInternalPlansRepository(client);
    this.provider = new InternalPlansProvider(repository);
    this.credits = new PlanCreditService(repository);
    this.queue = new InternalPlansQueue(repository);
  }

  enqueueActivation(input: ActivatePlanSubscriptionInput, retry = false) {
    return this.queue.enqueueActivation(input, retry);
  }

  findAvailableSubscriptionScore(input: FindAvailableSubscriptionScoreInput) {
    return this.provider.findAvailableSubscriptionScore(input);
  }

  useSubscriptionScore(input: UseSubscriptionScoreInput) {
    return this.provider.useSubscriptionScore(input);
  }

  listSubscriptionScores(input: ListSubscriptionScoresInput) {
    return this.provider.listSubscriptionScores(input);
  }

  addFamilyPlanMember(input: AddFamilyPlanMemberInput) {
    return this.provider.addFamilyPlanMember(input);
  }

  consumePlanCredit(input: ConsumeInternalPlanCreditInput) {
    return this.credits.consumeAtomically(input);
  }

  reconcilePlanCredit(input: {
    usageId: string;
    ownerType: 'appointment' | 'queue';
    ownerId: string;
    requestId: string;
  }) {
    return this.credits.reconcile(input);
  }
}

export function getPlansFacade(client: SupabaseClient) {
  return new PlansFacade(client);
}
