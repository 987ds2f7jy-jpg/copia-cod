export type OfficeLocationInput = {
  professionalPublicProfileId: string;
  action?: 'upsert' | 'delete' | 'get';
  location?: {
    addressLine: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city: string;
    state: string;
    postalCode?: string;
    formattedAddress?: string;
    latitude: number;
    longitude: number;
    mapboxPlaceId?: string;
  } | null;
};

export type OfficeLocationRecord = {
  id: string;
  professional_public_profile_id: string;
  address_line: string;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  formatted_address: string | null;
  latitude: number;
  longitude: number;
  mapbox_place_id: string | null;
  is_primary: boolean | null;
  is_public: boolean | null;
  geocoded_at: string | null;
};

export type UpsertOfficeLocationResult = {
  officeLocation: OfficeLocationRecord | null;
};

export type UpsertOfficeLocationRepository = {
  findProfessionalProfileIdByAppUserId(appUserId: string): Promise<string | null>;
  findPublicProfileById(publicProfileId: string): Promise<{ id: string; professional_profile_id: string; user_id: string } | null>;
  getPrimaryOfficeLocation(publicProfileId: string): Promise<OfficeLocationRecord | null>;
  upsertPrimaryOfficeLocation(params: {
    publicProfileId: string;
    record: Omit<OfficeLocationRecord, 'id'>;
  }): Promise<OfficeLocationRecord>;
  deletePrimaryOfficeLocation(publicProfileId: string): Promise<void>;
};

export type UpsertOfficeLocationCommand = {
  requestId: string;
  input: OfficeLocationInput;
  authenticatedUser: { authUserId: string; email: string | null };
};

