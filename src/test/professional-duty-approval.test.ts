import { describe, expect, it, vi } from 'vitest';
import { setProfessionalDuty } from '../../supabase/functions/set-professional-duty/service';
import type {
  ProfessionalDutyProfile,
  SetProfessionalDutyRepository,
} from '../../supabase/functions/set-professional-duty/types';

const approvedProfile: ProfessionalDutyProfile = {
  professionalId: '20000000-0000-4000-8000-000000000001',
  status: 'approved',
  specialty: 'Clinico Geral',
  publicProfileId: '30000000-0000-4000-8000-000000000001',
  publicStatus: 'approved',
};

function makeRepository(profile: ProfessionalDutyProfile) {
  return {
    findProfessionalDutyProfileByAppUserId: vi.fn().mockResolvedValue(profile),
    updateProfessionalDuty: vi.fn().mockResolvedValue(undefined),
    updatePublicDuty: vi.fn().mockResolvedValue(undefined),
  } as unknown as SetProfessionalDutyRepository;
}

function runDuty(repository: SetProfessionalDutyRepository, isOnDuty: boolean) {
  return setProfessionalDuty({
    requestId: 'request-duty',
    input: { isOnDuty },
    authenticatedUser: { authUserId: 'auth-professional', email: null },
    appUserId: '10000000-0000-4000-8000-000000000001',
    repository,
  });
}

describe('professional duty approval', () => {
  it('allows an approved eligible professional to activate duty', async () => {
    const repository = makeRepository(approvedProfile);

    await expect(runDuty(repository, true)).resolves.toMatchObject({ isOnDuty: true });
    expect(repository.updateProfessionalDuty).toHaveBeenCalledWith({
      professionalId: approvedProfile.professionalId,
      isOnDuty: true,
    });
    expect(repository.updatePublicDuty).toHaveBeenCalledTimes(1);
  });

  it.each(['pending', 'rejected', 'suspended'])(
    'blocks a %s professional from activating duty',
    async (status) => {
      const repository = makeRepository({ ...approvedProfile, status });

      await expect(runDuty(repository, true)).rejects.toMatchObject({
        status: 403,
        code: 'PROFESSIONAL_DUTY_NOT_AUTHORIZED',
      });
      expect(repository.updateProfessionalDuty).not.toHaveBeenCalled();
    },
  );

  it('blocks activation when the public profile is not approved', async () => {
    const repository = makeRepository({ ...approvedProfile, publicStatus: 'pending_review' });

    await expect(runDuty(repository, true)).rejects.toMatchObject({ status: 403 });
    expect(repository.updateProfessionalDuty).not.toHaveBeenCalled();
  });

  it('allows a suspended professional to turn off their own duty state', async () => {
    const repository = makeRepository({
      ...approvedProfile,
      status: 'suspended',
      publicStatus: 'suspended',
    });

    await expect(runDuty(repository, false)).resolves.toMatchObject({ isOnDuty: false });
    expect(repository.updateProfessionalDuty).toHaveBeenCalledWith({
      professionalId: approvedProfile.professionalId,
      isOnDuty: false,
    });
    expect(repository.updatePublicDuty).toHaveBeenCalledWith({
      publicProfileId: approvedProfile.publicProfileId,
      isOnDuty: false,
    });
  });
});
