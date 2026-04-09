import { AppError } from '../_shared/errors.ts';
import type { CreateSolicitacaoExameInput, JsonObject, JsonValue } from './types.ts';

const VALID_TIPOS = new Set(['checkup', 'especificos', 'renovacao_receitas', 'laudo_medico']);

function asTrimmedString(value: unknown) {
  return String(value ?? '').trim();
}

function asBoolean(value: unknown) {
  return Boolean(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(isJsonValue);
  }

  return false;
}

function asJsonObject(value: unknown, fieldName: string): JsonObject {
  if (value === null || value === undefined || value === '') {
    return {};
  }

  if (typeof value !== 'object' || Array.isArray(value) || !isJsonValue(value)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_JSON_OBJECT',
      message: `"${fieldName}" must be a JSON object.`,
    });
  }

  return value as JsonObject;
}

function asStringArray(value: unknown, fieldName: string) {
  if (value === null || value === undefined || value === '') {
    return [] as string[];
  }

  if (!Array.isArray(value)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_STRING_ARRAY',
      message: `"${fieldName}" must be an array of strings.`,
    });
  }

  const normalized = value
    .map((item) => asTrimmedString(item))
    .filter(Boolean);

  if (normalized.length !== value.filter((item) => asTrimmedString(item)).length) {
    throw new AppError({
      status: 400,
      code: 'INVALID_STRING_ARRAY',
      message: `"${fieldName}" must contain only strings.`,
    });
  }

  return normalized;
}

export function parseCreateSolicitacaoExameInput(body: unknown): CreateSolicitacaoExameInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_BODY',
      message: 'Request body must be an object.',
    });
  }

  const record = body as Record<string, unknown>;
  const tipo = asTrimmedString(record.tipo) as CreateSolicitacaoExameInput['tipo'];

  if (!VALID_TIPOS.has(tipo)) {
    throw new AppError({
      status: 400,
      code: 'TIPO_INVALID',
      message: '"tipo" must be one of checkup, especificos, renovacao_receitas or laudo_medico.',
    });
  }

  return {
    tipo,
    exameSolicitado: asTrimmedString(record.exameSolicitado),
    motivo: asTrimmedString(record.motivo),
    sintomas: asTrimmedString(record.sintomas),
    assintomaticoConfirmado: asBoolean(record.assintomaticoConfirmado),
    fluxoDestino: asTrimmedString(record.fluxoDestino),
    especialidadeDestino: asTrimmedString(record.especialidadeDestino),
    nomeMedicamento: asTrimmedString(record.nomeMedicamento),
    dosagem: asTrimmedString(record.dosagem),
    frequencia: asTrimmedString(record.frequencia),
    arquivoReceitaUrl: asTrimmedString(record.arquivoReceitaUrl),
    dadosIdentificacao: asJsonObject(record.dadosIdentificacao, 'dadosIdentificacao'),
    informacoesSaude: asJsonObject(record.informacoesSaude, 'informacoesSaude'),
    especificacaoLaudo: asJsonObject(record.especificacaoLaudo, 'especificacaoLaudo'),
    arquivos: asStringArray(record.arquivos, 'arquivos'),
    queueId: asTrimmedString(record.queueId),
  };
}
