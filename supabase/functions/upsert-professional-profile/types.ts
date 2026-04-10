export type UpsertProfessionalProfileInput = {
  bio?: string;
  photoUrl?: string;
  priceStandard?: number;
  pricePriority?: number;
  availableDays?: string[];
  availableHours?: string[];
  perfilAtivo?: boolean;
  prioritarioAtivo?: boolean;

  // Public profile fields
  instagramUrl?: string;
  tags?: string[];
  patientTypes?: string[];
  modality?: string;
  officeCity?: string;
  officeState?: string;
  officeAddress?: string;
  galleryUrls?: string[];
};

export type ProfessionalProfileRecord = {
  id: string;
  user_id: string;
  status: string;
  is_on_duty: boolean | null;
  bio: string | null;
  photo_url: string | null;
  price_standard: number | null;
  price_priority: number | null;
  available_days: string[] | null;
  available_hours: string[] | null;
  perfil_ativo: boolean | null;
  prioritario_ativo: boolean | null;
};

export type ProfessionalPublicProfileRecord = {
  id: string;
  professional_profile_id: string;
  status: string;
  is_on_duty: boolean | null;
  bio: string | null;
  photo_url: string | null;
  instagram_url: string | null;
  tags: string[] | null;
  patient_types: string[] | null;
  modality: string | null;
  office_city: string | null;
  office_state: string | null;
  office_address: string | null;
  gallery_urls: string[] | null;
  price_standard: number | null;
  price_priority: number | null;
  available_days: string[] | null;
  available_hours: string[] | null;
  perfil_ativo: boolean | null;
  prioritario_ativo: boolean | null;
};

export type AvailabilitySlotRecord = {
  id: string;
  professional_id: string;
  weekday: number;
  time_slot: string;
};

export type UpsertProfessionalProfileResult = {
  professional: ProfessionalProfileRecord;
  publicProfile: ProfessionalPublicProfileRecord | null;
  availabilitySlots: AvailabilitySlotRecord[];
};

export type UpsertProfessionalProfileRepository = {
  findProfessionalProfileByAppUserId(appUserId: string): Promise<ProfessionalProfileRecord | null>;
  findProfessionalPublicProfileByProfessionalId(professionalId: string): Promise<ProfessionalPublicProfileRecord | null>;
  updateProfessionalProfile(params: {
    professionalId: string;
    updates: Partial<ProfessionalProfileRecord>;
  }): Promise<ProfessionalProfileRecord>;
  updateProfessionalPublicProfile(params: {
    publicProfileId: string;
    updates: Partial<ProfessionalPublicProfileRecord>;
  }): Promise<ProfessionalPublicProfileRecord>;
  listAvailabilitySlotsByProfessionalId(professionalId: string): Promise<AvailabilitySlotRecord[]>;
};

export type UpsertProfessionalProfileCommand = {
  requestId: string;
  input: UpsertProfessionalProfileInput;
  authenticatedUser: {
    authUserId: string;
    email: string | null;
  };
};

