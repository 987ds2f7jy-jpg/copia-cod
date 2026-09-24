export type PlanSpecializationCompatibility = {
  legacySpecializationId: number;
  legacyName: string;
  localCode: string;
  concilType: 'medico' | 'psicologo' | 'nutricionista' | 'educador_fisico';
  aliases: readonly string[];
};

export const PLAN_SPECIALIZATIONS: readonly PlanSpecializationCompatibility[] = [
  { legacySpecializationId: 2, legacyName: 'Clinica Medica', localCode: 'clinica_medica', concilType: 'medico', aliases: ['clinico_geral'] },
  { legacySpecializationId: 22, legacyName: 'Psicologia', localCode: 'psicologia', concilType: 'psicologo', aliases: ['psicologia_clinica'] },
  { legacySpecializationId: 23, legacyName: 'Nutricao', localCode: 'nutricao', concilType: 'nutricionista', aliases: [] },
  { legacySpecializationId: 24, legacyName: 'Educacao Fisica', localCode: 'educacao_fisica', concilType: 'educador_fisico', aliases: [] },
] as const;

export function findPlanSpecialization(value: string | number) {
  const normalized = String(value || '').trim().toLowerCase();

  return PLAN_SPECIALIZATIONS.find((item) =>
    String(item.legacySpecializationId) === normalized
    || item.localCode === normalized
    || item.aliases.includes(normalized)
  ) || null;
}

