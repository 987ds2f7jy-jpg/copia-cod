import { invokeEdgeFunction } from './edgeFunctions';

function toTrimmedString(value) {
  return String(value ?? '').trim();
}

function normalizeStatus(value) {
  const status = toTrimmedString(value);
  return status || 'aguardando';
}

function normalizeCategory({ categoria, tipoAtendimento, serviceCode }) {
  const explicitCategory = toTrimmedString(categoria);

  if (explicitCategory === 'consulta' || explicitCategory === 'extra') {
    return explicitCategory;
  }

  const normalizedService = toTrimmedString(serviceCode).toLowerCase();
  const normalizedType = toTrimmedString(tipoAtendimento).toLowerCase();

  if (
    normalizedService.startsWith('extra_') ||
    normalizedType.includes('check-up') ||
    normalizedType.includes('exames') ||
    normalizedType.includes('receita') ||
    normalizedType.includes('laudo')
  ) {
    return 'extra';
  }

  return 'consulta';
}

function normalizePatientProntuarioItem(item) {
  if (!item) {
    return null;
  }

  const tipoAtendimento = toTrimmedString(item.tipo_atendimento ?? item.tipoAtendimento ?? item.tipo);
  const serviceCode = toTrimmedString(item.service_code ?? item.serviceCode);
  const plano = toTrimmedString(item.plano);

  return {
    id: toTrimmedString(item.id),
    consulta_id: toTrimmedString(item.consulta_id ?? item.consultationId),
    appointment_id: toTrimmedString(item.appointment_id ?? item.appointmentId),
    solicitacao_exame_id: toTrimmedString(item.solicitacao_exame_id ?? item.solicitacaoExameId),
    data: toTrimmedString(item.data),
    hora: toTrimmedString(item.horario ?? item.hora),
    tipo: tipoAtendimento || 'Consulta',
    categoria: normalizeCategory({
      categoria: item.categoria,
      tipoAtendimento,
      serviceCode,
    }),
    status: normalizeStatus(item.status),
    profissional: toTrimmedString(item.profissional_nome ?? item.profissionalNome ?? item.profissional),
    especialidade: toTrimmedString(item.especialidade),
    plano: plano || null,
    documentos: Array.isArray(item.documentos) ? item.documentos : [],
    service_code: serviceCode,
    created_at: toTrimmedString(item.created_at ?? item.createdAt),
    updated_at: toTrimmedString(item.updated_at ?? item.updatedAt),
  };
}

export async function getPatientProntuariosRequest({ limit = 100 } = {}) {
  const result = await invokeEdgeFunction('get-patient-prontuarios', {
    body: { limit },
    fallbackMessage: 'Nao foi possivel carregar seu prontuario.',
  });

  const items = Array.isArray(result?.items)
    ? result.items.map(normalizePatientProntuarioItem).filter((item) => item?.id)
    : [];

  return {
    items,
  };
}
