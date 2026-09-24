import type {
  ActivatePlanSubscriptionInput,
  ActivatePlanSubscriptionResult,
  AddFamilyPlanMemberInput,
  AvailableSubscriptionScore,
  FamilyPlanMemberResult,
  FindAvailableSubscriptionScoreInput,
  ListSubscriptionScoresInput,
  ListSubscriptionScoresResult,
  UseSubscriptionScoreInput,
  UseSubscriptionScoreResult,
} from './types.ts';

export interface PlansProvider {
  activatePlanSubscription(input: ActivatePlanSubscriptionInput): Promise<ActivatePlanSubscriptionResult>;
  findAvailableSubscriptionScore(
    input: FindAvailableSubscriptionScoreInput,
  ): Promise<AvailableSubscriptionScore | null>;
  useSubscriptionScore(input: UseSubscriptionScoreInput): Promise<UseSubscriptionScoreResult>;
  listSubscriptionScores(input: ListSubscriptionScoresInput): Promise<ListSubscriptionScoresResult>;
  addFamilyPlanMember(input: AddFamilyPlanMemberInput): Promise<FamilyPlanMemberResult>;
}

