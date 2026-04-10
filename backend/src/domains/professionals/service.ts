import { isApprovedStatus } from '../shared/status';

export type ProfessionalRecord = {
  id: string;
  status: string;
  specialty: string;
};

export function assertApprovedProfessional(professional: ProfessionalRecord | null) {
  if (!professional?.id) {
    throw new Error('PROFESSIONAL_NOT_FOUND');
  }
  if (!isApprovedStatus(professional.status)) {
    throw new Error('PROFESSIONAL_NOT_APPROVED');
  }
  return professional;
}
