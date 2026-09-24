import type {
  AddFamilyPlanMemberInput,
  FamilyPlanMemberResult,
} from '../../contracts/types.ts';
import type { InternalPlansRepository } from '../repositories/InternalPlansRepository.ts';

function text(value: unknown) { return String(value ?? '').trim(); }

export class FamilyPlanService {
  constructor(private readonly repository: InternalPlansRepository) {}

  async addMember(input: AddFamilyPlanMemberInput): Promise<FamilyPlanMemberResult> {
    const raw = await this.repository.addFamilyMember(input);
    return {
      backend: 'internal',
      memberId: text(raw.member_id),
      subscriptionId: text(raw.subscription_id),
      holderExternalKey: text(raw.holder_external_key),
      memberExternalKey: text(raw.member_external_key),
      createdAt: text(raw.created_at) || null,
      raw,
    };
  }
}

