import { AppError } from '../_shared/errors.ts';
import type { UpsertProntuarioInput } from './types.ts';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function validateFieldLength(value: string, fieldName: string) {
  if (value.length > 10000) {
    throw new AppError({
      status: 422,
      code: 'PRONTUARIO_FIELD_TOO_LONG',
      message: `"${fieldName}" must be at most 10000 characters.`,
    });
  }
}

export function parseUpsertProntuarioInput(body: unknown): UpsertProntuarioInput {
  if (!body || typeof body !== 'object') {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const consultationId = String(record.consultationId ?? '').trim();
  const mode = String(record.mode ?? 'completo').trim() === 'simples' ? 'simples' : 'completo';
  const motivoConsulta = normalizeText(record.motivoConsulta);
  const historicoRisco = normalizeText(record.historicoRisco);
  const examesImagem = normalizeText(record.examesImagem);
  const exameFisico = normalizeText(record.exameFisico);
  const avaliacaoDiagnostico = normalizeText(record.avaliacaoDiagnostico);
  const recomendacoes = normalizeText(record.recomendacoes);

  if (!UUID_REGEX.test(consultationId)) {
    throw new AppError({
      status: 400,
      code: 'CONSULTATION_ID_INVALID',
      message: '"consultationId" must be a valid UUID.',
    });
  }

  if (!motivoConsulta) {
    throw new AppError({
      status: 422,
      code: 'PRONTUARIO_REASON_REQUIRED',
      message: '"motivoConsulta" is required.',
    });
  }

  if (!recomendacoes) {
    throw new AppError({
      status: 422,
      code: 'PRONTUARIO_RECOMMENDATIONS_REQUIRED',
      message: '"recomendacoes" is required.',
    });
  }

  [
    ['motivoConsulta', motivoConsulta],
    ['historicoRisco', historicoRisco],
    ['examesImagem', examesImagem],
    ['exameFisico', exameFisico],
    ['avaliacaoDiagnostico', avaliacaoDiagnostico],
    ['recomendacoes', recomendacoes],
  ].forEach(([fieldName, value]) => validateFieldLength(String(value), String(fieldName)));

  return {
    consultationId,
    mode,
    motivoConsulta,
    historicoRisco,
    examesImagem,
    exameFisico,
    avaliacaoDiagnostico,
    recomendacoes,
  };
}
