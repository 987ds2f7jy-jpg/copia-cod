import { AppError } from '../_shared/errors.ts';
import type {
  OfficeLocationRecord,
  UpsertOfficeLocationCommand,
  UpsertOfficeLocationRepository,
  UpsertOfficeLocationResult,
} from './types.ts';

function toStringOrEmpty(value: unknown) {
  return String(value ?? '').trim();
}

export async function upsertOfficeLocation({
  requestId,
  input,
  authenticatedUser,
  appUser,
  repository,
}: {
  appUser: { id: string; role: string };
  repository: UpsertOfficeLocationRepository;
} & UpsertOfficeLocationCommand): Promise<UpsertOfficeLocationResult> {
  console.info('[upsert-office-location] request:start', {
    requestId,
    authUserId: authenticatedUser.authUserId || null,
    appUserId: appUser.id || null,
    publicProfileId: input.professionalPublicProfileId,
    action: input.action || 'upsert',
  });

  const publicProfile = await repository.findPublicProfileById(input.professionalPublicProfileId);

  if (!publicProfile?.id) {
    throw new AppError({
      status: 404,
      code: 'PUBLIC_PROFILE_NOT_FOUND',
      message: 'Public profile not found.',
    });
  }

  if ((input.action || 'upsert') === 'get') {
    const officeLocation = await repository.getPrimaryOfficeLocation(publicProfile.id);
    return { officeLocation };
  }

  // Professionals can only edit their own public profile; admins can edit any.
  if (appUser.role !== 'admin') {
    const professionalId = await repository.findProfessionalProfileIdByAppUserId(appUser.id);
    if (!professionalId || toStringOrEmpty(publicProfile.professional_profile_id) !== professionalId) {
      throw new AppError({
        status: 403,
        code: 'OFFICE_LOCATION_FORBIDDEN',
        message: 'You are not allowed to update this office location.',
      });
    }
  }

  if ((input.action || 'upsert') === 'delete') {
    await repository.deletePrimaryOfficeLocation(publicProfile.id);
    return { officeLocation: null };
  }

  if (!input.location) {
    throw new AppError({
      status: 400,
      code: 'LOCATION_REQUIRED',
      message: '"location" is required.',
    });
  }

  const record: Omit<OfficeLocationRecord, 'id'> = {
    professional_public_profile_id: publicProfile.id,
    address_line: input.location.addressLine,
    number: input.location.number || '',
    complement: input.location.complement || '',
    neighborhood: input.location.neighborhood || '',
    city: input.location.city,
    state: input.location.state,
    postal_code: input.location.postalCode || '',
    formatted_address: input.location.formattedAddress || '',
    latitude: input.location.latitude,
    longitude: input.location.longitude,
    mapbox_place_id: input.location.mapboxPlaceId || '',
    is_primary: true,
    is_public: true,
    geocoded_at: new Date().toISOString(),
  };

  const officeLocation = await repository.upsertPrimaryOfficeLocation({
    publicProfileId: publicProfile.id,
    record,
  });

  console.info('[upsert-office-location] request:success', {
    requestId,
    officeLocationId: officeLocation.id,
  });

  return { officeLocation };
}

