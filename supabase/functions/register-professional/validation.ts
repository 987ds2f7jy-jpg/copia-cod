import { AppError } from '../_shared/errors.ts';
import type { RegisterProfessionalInput } from './types.ts';

const MODALITIES = new Set(['online', 'presencial', 'ambos']);

function sanitizeStringArray(value: unknown, maxItems = 20) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

export function parseRegisterProfessionalInput(body: unknown): RegisterProfessionalInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const fullName = String(record.fullName ?? '').trim();
  const profession = String(record.profession ?? '').trim();
  const specialty = String(record.specialty ?? '').trim();
  const registerNumber = String(record.registerNumber ?? '').trim();
  const registerState = String(record.registerState ?? '').trim().toUpperCase();
  const rqe = String(record.rqe ?? '').trim();
  const university = String(record.university ?? '').trim();
  const graduationYear = Number(record.graduationYear ?? 0);
  const diplomaUrl = String(record.diplomaUrl ?? '').trim();
  const sex = String(record.sex ?? '').trim();
  const phone = String(record.phone ?? '').trim();
  const cpf = String(record.cpf ?? '').trim();
  const photoUrl = String(record.photoUrl ?? '').trim();
  const bio = String(record.bio ?? '').trim();
  const instagramUrl = String(record.instagramUrl ?? '').trim();
  const modality = String(record.modality ?? 'online').trim();
  const officeCity = String(record.officeCity ?? '').trim();
  const officeState = String(record.officeState ?? '').trim().toUpperCase();
  const officeAddress = String(record.officeAddress ?? '').trim();
  const patientTypes = sanitizeStringArray(record.patientTypes);
  const tags = sanitizeStringArray(record.tags);
  const galleryUrls = sanitizeStringArray(record.galleryUrls);

  if (fullName.length < 3) {
    throw new AppError({
      status: 422,
      code: 'FULL_NAME_REQUIRED',
      message: '"fullName" must have at least 3 characters.',
    });
  }

  if (!profession || !specialty || !registerNumber || !registerState || !university || !diplomaUrl) {
    throw new AppError({
      status: 422,
      code: 'PROFESSIONAL_REQUIRED_FIELDS_MISSING',
      message: 'Profession, specialty, register data, university and diploma are required.',
    });
  }

  if (registerState.length !== 2) {
    throw new AppError({
      status: 422,
      code: 'REGISTER_STATE_INVALID',
      message: '"registerState" must contain a 2-letter state code.',
    });
  }

  if (!Number.isInteger(graduationYear) || graduationYear < 1900 || graduationYear > new Date().getFullYear() + 1) {
    throw new AppError({
      status: 422,
      code: 'GRADUATION_YEAR_INVALID',
      message: '"graduationYear" must be a valid year.',
    });
  }

  if (!MODALITIES.has(modality)) {
    throw new AppError({
      status: 422,
      code: 'MODALITY_INVALID',
      message: '"modality" must be one of online, presencial or ambos.',
    });
  }

  return {
    fullName,
    profession,
    specialty,
    registerNumber,
    registerState,
    rqe,
    university,
    graduationYear,
    diplomaUrl,
    sex,
    phone,
    cpf,
    photoUrl,
    bio,
    instagramUrl,
    patientTypes,
    tags,
    modality: modality as RegisterProfessionalInput['modality'],
    officeCity,
    officeState,
    officeAddress,
    galleryUrls,
  };
}
