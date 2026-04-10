export type ReplaceAvailabilitySlotsInput = {
  slots: Array<{
    weekday: number;
    timeSlot: string;
  }>;
};

export type AvailabilitySlotRecord = {
  id: string;
  professional_id: string;
  weekday: number;
  time_slot: string;
};

export type ReplaceAvailabilitySlotsResult = {
  professionalId: string;
  slots: AvailabilitySlotRecord[];
};

export type ReplaceAvailabilitySlotsRepository = {
  findProfessionalProfileIdByAppUserId(appUserId: string): Promise<string | null>;
  deleteSlotsByProfessionalId(professionalId: string): Promise<void>;
  insertSlots(params: {
    professionalId: string;
    slots: Array<{ weekday: number; time_slot: string }>;
  }): Promise<AvailabilitySlotRecord[]>;
  listSlotsByProfessionalId(professionalId: string): Promise<AvailabilitySlotRecord[]>;
};

export type ReplaceAvailabilitySlotsCommand = {
  requestId: string;
  input: ReplaceAvailabilitySlotsInput;
  authenticatedUser: {
    authUserId: string;
    email: string | null;
  };
};

