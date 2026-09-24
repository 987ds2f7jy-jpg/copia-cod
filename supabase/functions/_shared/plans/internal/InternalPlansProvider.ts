import type { PlansProvider } from '../contracts/PlansProvider.ts';
import type {
  ActivatePlanSubscriptionInput,
  AddFamilyPlanMemberInput,
  FindAvailableSubscriptionScoreInput,
  ListSubscriptionScoresInput,
  UseSubscriptionScoreInput,
} from '../contracts/types.ts';
import type { InternalPlansRepository } from './repositories/InternalPlansRepository.ts';
import { FamilyPlanService } from './services/FamilyPlanService.ts';
import { PlanSubscriptionService } from './services/PlanSubscriptionService.ts';
import { SubscriptionScoreService } from './services/SubscriptionScoreService.ts';

export class InternalPlansProvider implements PlansProvider {
  private readonly subscriptions: PlanSubscriptionService;
  private readonly scores: SubscriptionScoreService;
  private readonly family: FamilyPlanService;

  constructor(repository: InternalPlansRepository) {
    this.subscriptions = new PlanSubscriptionService(repository);
    this.scores = new SubscriptionScoreService(repository);
    this.family = new FamilyPlanService(repository);
  }

  activatePlanSubscription(input: ActivatePlanSubscriptionInput) {
    return this.subscriptions.activate(input);
  }

  findAvailableSubscriptionScore(input: FindAvailableSubscriptionScoreInput) {
    return this.scores.findAvailable(input);
  }

  useSubscriptionScore(input: UseSubscriptionScoreInput) {
    return this.scores.use(input);
  }

  listSubscriptionScores(input: ListSubscriptionScoresInput) {
    return this.scores.list(input);
  }

  addFamilyPlanMember(input: AddFamilyPlanMemberInput) {
    return this.family.addMember(input);
  }
}

