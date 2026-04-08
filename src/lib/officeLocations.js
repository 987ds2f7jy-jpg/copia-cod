import { supabase } from '@/integrations/supabase/client';

const TABLE = 'professional_office_locations';

export async function getOfficeLocation(publicProfileId) {
  if (!publicProfileId) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('professional_public_profile_id', publicProfileId)
    .eq('is_primary', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveOfficeLocation(publicProfileId, locationData) {
  if (!publicProfileId) throw new Error('Missing publicProfileId');

  // Check if primary location exists
  const existing = await getOfficeLocation(publicProfileId);

  const record = {
    professional_public_profile_id: publicProfileId,
    address_line: locationData.address_line,
    number: locationData.number || '',
    complement: locationData.complement || '',
    neighborhood: locationData.neighborhood || '',
    city: locationData.city,
    state: locationData.state,
    postal_code: locationData.postal_code || '',
    formatted_address: locationData.formatted_address || '',
    latitude: locationData.latitude,
    longitude: locationData.longitude,
    mapbox_place_id: locationData.mapbox_place_id || '',
    is_primary: true,
    is_public: true,
    geocoded_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase
      .from(TABLE)
      .update(record)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export async function deleteOfficeLocation(publicProfileId) {
  if (!publicProfileId) return;
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('professional_public_profile_id', publicProfileId)
    .eq('is_primary', true);
  if (error) throw error;
}
