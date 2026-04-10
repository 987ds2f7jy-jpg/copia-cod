import {
  deleteOfficeLocationRequest,
  getOfficeLocationRequest,
  upsertOfficeLocationRequest,
} from '@/client-api/professionalDashboard';

function mapOfficeLocationPayload(locationData) {
  return {
    addressLine: locationData.address_line || '',
    number: locationData.number || '',
    complement: locationData.complement || '',
    neighborhood: locationData.neighborhood || '',
    city: locationData.city || '',
    state: String(locationData.state || '').toUpperCase(),
    postalCode: locationData.postal_code || '',
    formattedAddress: locationData.formatted_address || '',
    latitude: Number(locationData.latitude || 0),
    longitude: Number(locationData.longitude || 0),
    mapboxPlaceId: locationData.mapbox_place_id || '',
  };
}

export async function getOfficeLocation(publicProfileId) {
  if (!publicProfileId) return null;
  const result = await getOfficeLocationRequest({ professionalPublicProfileId: publicProfileId });
  return result?.officeLocation ?? null;
}

export async function saveOfficeLocation(publicProfileId, locationData) {
  if (!publicProfileId) throw new Error('Missing publicProfileId');
  const result = await upsertOfficeLocationRequest({
    professionalPublicProfileId: publicProfileId,
    action: 'upsert',
    location: mapOfficeLocationPayload(locationData),
  });
  return result?.officeLocation ?? null;
}

export async function deleteOfficeLocation(publicProfileId) {
  if (!publicProfileId) return;
  await deleteOfficeLocationRequest({ professionalPublicProfileId: publicProfileId });
}
