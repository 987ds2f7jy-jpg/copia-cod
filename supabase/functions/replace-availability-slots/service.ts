import { AppError } from '../_shared/errors.ts';
import type {
  ReplaceAvailabilitySlotsCommand,
  ReplaceAvailabilitySlotsRepository,
  ReplaceAvailabilitySlotsResult,
} from './types.ts';

export async function replaceAvailabilitySlots({
  requestId,
  input,
  authenticatedUser,
  appUserId,
  repository,
}: {
  appUserId: string;
  repository: ReplaceAvailabilitySlotsRepository;
} & ReplaceAvailabilitySlotsCommand): Promise<ReplaceAvailabilitySlotsResult> {
  console.info('[replace-availability-slots] request:start', {
    requestId,
    authUserId: authenticatedUser.authUserId,
    appUserId,
    slots: input.slots.length,
  });

  const professionalId = await repository.findProfessionalProfileIdByAppUserId(appUserId);

  if (!professionalId) {
    throw new AppError({
      status: 404,
      code: 'PROFESSIONAL_PROFILE_NOT_FOUND',
      message: 'Professional profile not found.',
    });
  }

  const uniqueKeys = new Set<string>();
  const normalizedSlots = input.slots.map((slot) => {
    const key = `${slot.weekday}|${slot.timeSlot}`;
    if (uniqueKeys.has(key)) {
      return null;
    }
    uniqueKeys.add(key);
    return { weekday: slot.weekday, time_slot: slot.timeSlot };
  }).filter(Boolean) as Array<{ weekday: number; time_slot: string }>;

  await repository.deleteSlotsByProfessionalId(professionalId);
  await repository.insertSlots({ professionalId, slots: normalizedSlots });
  const savedSlots = await repository.listSlotsByProfessionalId(professionalId);

  console.info('[replace-availability-slots] request:success', {
    requestId,
    professionalId,
    saved: savedSlots.length,
  });

  return {
    professionalId,
    slots: savedSlots,
  };
}

