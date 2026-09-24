import type { FindAvailableSubscriptionScoreInput } from '../../contracts/types.ts';
import { SubscriptionScoreService } from './SubscriptionScoreService.ts';

export class PlanCoverageService {
  constructor(private readonly subscriptionScores: SubscriptionScoreService) {}

  findAvailable(input: FindAvailableSubscriptionScoreInput) {
    return this.subscriptionScores.findAvailable(input);
  }
}

