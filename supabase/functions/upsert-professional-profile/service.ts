import { AppError } from '../_shared/errors.ts';
import { normalizeUploadPath, normalizeUploadPathList } from '../_shared/uploadPaths.ts';
import type {
  UpsertProfessionalProfileCommand,
  UpsertProfessionalProfileRepository,
  UpsertProfessionalProfileResult,
} from './types.ts';

function toArrayOrDefault(value: string[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

export async function upsertProfessionalProfile({
  requestId,
  input,
  authenticatedUser,
  appUserId,
  repository,
}: {
  appUserId: string;
  repository: UpsertProfessionalProfileRepository;
} & UpsertProfessionalProfileCommand): Promise<UpsertProfessionalProfileResult> {
  console.info('[upsert-professional-profile] request:start', {
    requestId,
    authUserId: authenticatedUser.authUserId,
    appUserId,
  });

  const professional = await repository.findProfessionalProfileByAppUserId(appUserId);

  if (!professional?.id) {
    throw new AppError({
      status: 404,
      code: 'PROFESSIONAL_PROFILE_NOT_FOUND',
      message: 'Professional profile not found.',
    });
  }

  const availabilitySlots = await repository.listAvailabilitySlotsByProfessionalId(professional.id);
  const hasGranularAvailability = availabilitySlots.length > 0;

  const nextPriceStandard = input.priceStandard ?? Number(professional.price_standard ?? 0);
  const nextAvailableDays = input.availableDays ?? toArrayOrDefault(professional.available_days);
  const nextPerfilAtivo = input.perfilAtivo ?? Boolean(professional.perfil_ativo);

  if (nextPerfilAtivo) {
    const hasPrice = Number(nextPriceStandard || 0) > 0;
    const hasDays = nextAvailableDays.length > 0 || hasGranularAvailability;

    if (!hasPrice || !hasDays) {
      throw new AppError({
        status: 422,
        code: 'PERFIL_ATIVO_INVALID',
        message: 'To activate the profile, configure price and availability first.',
        details: {
          hasPrice,
          hasDays,
          hasGranularAvailability,
        },
      });
    }
  }

  const privateUpdates: Record<string, unknown> = {};
  const publicUpdates: Record<string, unknown> = {};

  if (input.bio !== undefined) {
    privateUpdates.bio = input.bio;
    publicUpdates.bio = input.bio;
  }

  if (input.photoUrl !== undefined) {
    const photoUrl = normalizeUploadPath(input.photoUrl, {
      allowedPrefixes: ['professionals/photos/'],
      fieldName: 'photoUrl',
    });
    privateUpdates.photo_url = photoUrl;
    publicUpdates.photo_url = photoUrl;
  }

  if (input.priceStandard !== undefined) {
    privateUpdates.price_standard = input.priceStandard;
    publicUpdates.price_standard = input.priceStandard;
  }

  if (input.pricePriority !== undefined) {
    privateUpdates.price_priority = input.pricePriority;
    publicUpdates.price_priority = input.pricePriority;
  }

  if (input.availableDays !== undefined) {
    privateUpdates.available_days = input.availableDays;
    publicUpdates.available_days = input.availableDays;
  }

  if (input.availableHours !== undefined) {
    privateUpdates.available_hours = input.availableHours;
    publicUpdates.available_hours = input.availableHours;
  }

  if (input.perfilAtivo !== undefined) {
    privateUpdates.perfil_ativo = input.perfilAtivo;
    publicUpdates.perfil_ativo = input.perfilAtivo;
  }

  if (input.prioritarioAtivo !== undefined) {
    privateUpdates.prioritario_ativo = input.prioritarioAtivo;
    publicUpdates.prioritario_ativo = input.prioritarioAtivo;
  }

  if (input.instagramUrl !== undefined) publicUpdates.instagram_url = input.instagramUrl;
  if (input.tags !== undefined) publicUpdates.tags = input.tags;
  if (input.patientTypes !== undefined) publicUpdates.patient_types = input.patientTypes;
  if (input.modality !== undefined) publicUpdates.modality = input.modality;
  if (input.officeCity !== undefined) publicUpdates.office_city = input.officeCity;
  if (input.officeState !== undefined) publicUpdates.office_state = input.officeState;
  if (input.officeAddress !== undefined) publicUpdates.office_address = input.officeAddress;
  if (input.galleryUrls !== undefined) {
    publicUpdates.gallery_urls = normalizeUploadPathList(input.galleryUrls, {
      allowedPrefixes: ['professionals/gallery/'],
      fieldName: 'galleryUrls',
    });
  }

  const updatedProfessional = Object.keys(privateUpdates).length > 0
    ? await repository.updateProfessionalProfile({
      professionalId: professional.id,
      updates: privateUpdates,
    })
    : professional;

  const publicProfile = await repository.findProfessionalPublicProfileByProfessionalId(professional.id);

  const updatedPublicProfile = publicProfile?.id && Object.keys(publicUpdates).length > 0
    ? await repository.updateProfessionalPublicProfile({
      publicProfileId: publicProfile.id,
      updates: publicUpdates,
    })
    : publicProfile;

  const nextAvailabilitySlots = await repository.listAvailabilitySlotsByProfessionalId(professional.id);

  console.info('[upsert-professional-profile] request:success', {
    requestId,
    professionalId: updatedProfessional.id,
    publicProfileId: updatedPublicProfile?.id || null,
  });

  return {
    professional: updatedProfessional,
    publicProfile: updatedPublicProfile,
    availabilitySlots: nextAvailabilitySlots,
  };
}

