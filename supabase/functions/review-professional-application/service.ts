import type {
  ReviewProfessionalApplicationCommand,
  ReviewProfessionalApplicationRepository,
  ReviewProfessionalApplicationResult,
} from './types.ts';

function mapAdminAction(action: 'approve' | 'reject' | 'suspend') {
  if (action === 'approve') {
    return { publicStatus: 'approved', privateStatus: 'approved', isOnDuty: false };
  }
  if (action === 'suspend') {
    return { publicStatus: 'suspended', privateStatus: 'suspended', isOnDuty: false };
  }
  return { publicStatus: 'rejected', privateStatus: 'rejected', isOnDuty: false };
}

export async function reviewProfessionalApplication({
  requestId,
  input,
  authenticatedUser,
  repository,
}: {
  repository: ReviewProfessionalApplicationRepository;
} & ReviewProfessionalApplicationCommand): Promise<ReviewProfessionalApplicationResult> {
  const publicProfile = await repository.findPublicProfileById(input.publicProfileId);
  const mapping = mapAdminAction(input.action);

  console.info('[review-professional-application] request:start', {
    requestId,
    authUserId: authenticatedUser.authUserId,
    publicProfileId: input.publicProfileId,
    action: input.action,
  });

  await repository.updatePublicProfile({
    publicProfileId: input.publicProfileId,
    updates: {
      status: mapping.publicStatus,
      is_on_duty: mapping.isOnDuty,
    },
  });

  if (publicProfile?.professional_profile_id) {
    await repository.updatePrivateProfile({
      professionalId: publicProfile.professional_profile_id,
      updates: {
        status: mapping.privateStatus,
        is_on_duty: mapping.isOnDuty,
      },
    });
  }

  console.info('[review-professional-application] request:success', {
    requestId,
    publicProfileId: input.publicProfileId,
    professionalId: publicProfile?.professional_profile_id || null,
    publicStatus: mapping.publicStatus,
    privateStatus: mapping.privateStatus,
  });

  return {
    publicProfileId: input.publicProfileId,
    privateProfileId: publicProfile?.professional_profile_id || null,
    publicStatus: mapping.publicStatus,
    privateStatus: publicProfile?.professional_profile_id ? mapping.privateStatus : null,
    isOnDuty: mapping.isOnDuty,
  };
}

