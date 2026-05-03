import { requireAuthenticatedUser } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import {
  createRequestId,
  ensureMethod,
  errorResponse,
  handlePreflight,
  readJsonBody,
  successResponse,
} from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { requireAppUserByAuthUserId, requireRole } from '../_shared/professional.ts';
import {
  createServiceRoleClient,
  createSupabaseAuthUserLookup,
  type SupabaseClient,
} from '../_shared/supabase.ts';

const FUNCTION_NAME = 'get-patient-prontuarios';
const CORS: CorsOptions = { allowedMethods: ['POST'] };
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

type RequestBody = {
  limit?: number;
};

type ConsultaRow = {
  id: string;
  paciente_id: string | null;
  profissional_nome: string | null;
  especialidade: string | null;
  tipo_consulta: string | null;
  status: string | null;
  datetime: string | null;
  service_code: string | null;
  created_date: string | null;
  updated_at: string | null;
};

type AppointmentRow = {
  id: string;
  consulta_id: string | null;
  appointment_type: string | null;
  status: string | null;
  date: string | null;
  time: string | null;
  scheduled_datetime: string | null;
  professional_name: string | null;
  specialty: string | null;
  service_code: string | null;
  created_date: string | null;
  updated_at: string | null;
};

type ProntuarioRow = {
  id: string;
  consulta_id: string | null;
  solicitacao_exame_id: string | null;
  paciente_id: string | null;
  profissional_id: string | null;
  recomendacoes: string | null;
  created_date: string | null;
  updated_at: string | null;
};

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeLimit(value: unknown) {
  const numeric = Number(value || 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.trunc(numeric), MAX_LIMIT);
}

function parseDateParts(value: unknown) {
  const rawValue = normalizeString(value);

  if (!rawValue) {
    return { data: '', horario: '' };
  }

  const parsed = new Date(rawValue);

  if (!Number.isNaN(parsed.getTime())) {
    return {
      data: parsed.toISOString().slice(0, 10),
      horario: parsed.toISOString().slice(11, 16),
    };
  }

  const [datePart = '', timePart = ''] = rawValue.split(/[T\s]/);

  return {
    data: datePart.slice(0, 10),
    horario: timePart.slice(0, 5),
  };
}

function resolveDateTime({
  appointment,
  consulta,
  prontuario,
}: {
  appointment?: AppointmentRow | null;
  consulta?: ConsultaRow | null;
  prontuario: ProntuarioRow;
}) {
  const appointmentDate = normalizeString(appointment?.date);
  const appointmentTime = normalizeString(appointment?.time);

  if (appointmentDate || appointmentTime) {
    return {
      data: appointmentDate,
      horario: appointmentTime,
    };
  }

  const scheduled = parseDateParts(appointment?.scheduled_datetime);
  if (scheduled.data || scheduled.horario) {
    return scheduled;
  }

  const consultationDate = parseDateParts(consulta?.datetime);
  if (consultationDate.data || consultationDate.horario) {
    return consultationDate;
  }

  return parseDateParts(prontuario.updated_at || prontuario.created_date);
}

function resolveServiceLabel({
  serviceCode,
  appointmentType,
  consultationType,
}: {
  serviceCode: string;
  appointmentType: string;
  consultationType: string;
}) {
  const normalizedService = serviceCode.toLowerCase();

  const serviceLabels: Record<string, string> = {
    extra_checkup: 'Check-up',
    extra_exames_especificos: 'Exames específicos',
    extra_renovacao_receitas: 'Renovação de receita',
    extra_laudo_medico: 'Laudo médico',
  };

  if (serviceLabels[normalizedService]) {
    return serviceLabels[normalizedService];
  }

  const normalizedAppointmentType = appointmentType.toLowerCase();
  const normalizedConsultationType = consultationType.toLowerCase();

  if (
    normalizedAppointmentType === 'imediato' ||
    normalizedConsultationType === 'plantao' ||
    normalizedService.startsWith('on_duty_')
  ) {
    return 'Plantão / Consulta Agora';
  }

  if (
    normalizedAppointmentType === 'priority' ||
    normalizedAppointmentType === 'prioritario' ||
    normalizedConsultationType === 'prioritario' ||
    normalizedService === 'profile_priority'
  ) {
    return 'Consulta prioritária';
  }

  if (
    normalizedAppointmentType === 'especialidade' ||
    normalizedConsultationType === 'especialidade' ||
    normalizedService === 'specialty_request'
  ) {
    return 'Consulta por especialidade';
  }

  return 'Consulta';
}

function resolveCategory(serviceCode: string, serviceLabel: string) {
  const normalizedService = serviceCode.toLowerCase();
  const normalizedLabel = serviceLabel.toLowerCase();

  if (
    normalizedService.startsWith('extra_') ||
    normalizedLabel.includes('check-up') ||
    normalizedLabel.includes('exames') ||
    normalizedLabel.includes('receita') ||
    normalizedLabel.includes('laudo')
  ) {
    return 'extra';
  }

  return 'consulta';
}

function resolveStatus({
  plano,
  serviceCode,
  consultaStatus,
  appointmentStatus,
}: {
  plano: string;
  serviceCode: string;
  consultaStatus: string;
  appointmentStatus: string;
}) {
  if (!plano) {
    return 'aguardando';
  }

  if (serviceCode.toLowerCase().startsWith('extra_')) {
    return 'documento_disponivel';
  }

  const normalizedStatus = (consultaStatus || appointmentStatus).toLowerCase();

  if (normalizedStatus === 'em_atendimento' || normalizedStatus === 'in_progress') {
    return 'em_andamento';
  }

  return 'finalizado';
}

async function listConsultasForPatient(client: SupabaseClient, patientId: string, limit: number) {
  const { data, error } = await client
    .from('consultas')
    .select(`
      id,
      paciente_id,
      profissional_nome,
      especialidade,
      tipo_consulta,
      status,
      datetime,
      service_code,
      created_date,
      updated_at
    `)
    .eq('paciente_id', patientId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PATIENT_CONSULTAS_LOOKUP_FAILED',
      message: 'Unable to load patient consultations.',
      details: error.message,
    });
  }

  return (data as ConsultaRow[] | null) || [];
}

async function listProntuariosByConsultaIds(client: SupabaseClient, consultaIds: string[]) {
  if (consultaIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from('prontuarios')
    .select(`
      id,
      consulta_id,
      solicitacao_exame_id,
      paciente_id,
      profissional_id,
      recomendacoes,
      created_date,
      updated_at
    `)
    .in('consulta_id', consultaIds);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PATIENT_PRONTUARIOS_BY_CONSULTA_LOOKUP_FAILED',
      message: 'Unable to load patient medical records by consultation.',
      details: error.message,
    });
  }

  return (data as ProntuarioRow[] | null) || [];
}

async function listProntuariosByPatientId(client: SupabaseClient, patientId: string, limit: number) {
  const { data, error } = await client
    .from('prontuarios')
    .select(`
      id,
      consulta_id,
      solicitacao_exame_id,
      paciente_id,
      profissional_id,
      recomendacoes,
      created_date,
      updated_at
    `)
    .eq('paciente_id', patientId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PATIENT_PRONTUARIOS_LOOKUP_FAILED',
      message: 'Unable to load patient medical records.',
      details: error.message,
    });
  }

  return (data as ProntuarioRow[] | null) || [];
}

async function listAppointmentsByConsultaIds(client: SupabaseClient, consultaIds: string[]) {
  if (consultaIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from('appointments')
    .select(`
      id,
      consulta_id,
      appointment_type,
      status,
      date,
      time,
      scheduled_datetime,
      professional_name,
      specialty,
      service_code,
      created_date,
      updated_at
    `)
    .in('consulta_id', consultaIds);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PATIENT_PRONTUARIO_APPOINTMENTS_LOOKUP_FAILED',
      message: 'Unable to load patient appointment metadata.',
      details: error.message,
    });
  }

  return (data as AppointmentRow[] | null) || [];
}

function mergeProntuarios(groups: ProntuarioRow[][]) {
  const merged = new Map<string, ProntuarioRow>();

  groups.flat().forEach((row) => {
    if (!row?.id || merged.has(row.id)) {
      return;
    }

    merged.set(row.id, row);
  });

  return Array.from(merged.values());
}

function pickLatestAppointmentByConsulta(appointments: AppointmentRow[]) {
  const mapped = new Map<string, AppointmentRow>();

  appointments.forEach((appointment) => {
    const consultaId = normalizeString(appointment.consulta_id);
    if (!consultaId) {
      return;
    }

    const current = mapped.get(consultaId);
    const currentTime = Date.parse(current?.updated_at || current?.created_date || '');
    const nextTime = Date.parse(appointment.updated_at || appointment.created_date || '');

    if (!current || (Number.isFinite(nextTime) && (!Number.isFinite(currentTime) || nextTime > currentTime))) {
      mapped.set(consultaId, appointment);
    }
  });

  return mapped;
}

async function getPatientProntuarios({
  client,
  patientId,
  limit,
}: {
  client: SupabaseClient;
  patientId: string;
  limit: number;
}) {
  const consultas = await listConsultasForPatient(client, patientId, Math.max(limit * 2, DEFAULT_LIMIT));
  const consultaById = new Map(
    consultas
      .filter((row) => row?.id)
      .map((row) => [row.id, row]),
  );
  const consultaIds = Array.from(consultaById.keys());

  const [byConsultation, byPatient] = await Promise.all([
    listProntuariosByConsultaIds(client, consultaIds),
    listProntuariosByPatientId(client, patientId, limit),
  ]);

  const prontuarios = mergeProntuarios([byConsultation, byPatient])
    .filter((row) => {
      const consultaId = normalizeString(row.consulta_id);
      const consulta = consultaById.get(consultaId);

      return row.paciente_id === patientId || consulta?.paciente_id === patientId;
    });

  const prontuarioConsultaIds = Array.from(new Set(
    prontuarios
      .map((row) => normalizeString(row.consulta_id))
      .filter(Boolean),
  ));

  const appointmentsByConsulta = pickLatestAppointmentByConsulta(
    await listAppointmentsByConsultaIds(client, prontuarioConsultaIds),
  );

  const items = prontuarios
    .map((prontuario) => {
      const consultaId = normalizeString(prontuario.consulta_id);
      const consulta = consultaById.get(consultaId) || null;
      const appointment = appointmentsByConsulta.get(consultaId) || null;
      const plano = normalizeString(prontuario.recomendacoes);
      const serviceCode = normalizeString(appointment?.service_code || consulta?.service_code);
      const tipoAtendimento = resolveServiceLabel({
        serviceCode,
        appointmentType: normalizeString(appointment?.appointment_type),
        consultationType: normalizeString(consulta?.tipo_consulta),
      });
      const dateTime = resolveDateTime({ appointment, consulta, prontuario });

      return {
        id: prontuario.id,
        consulta_id: consultaId || null,
        appointment_id: appointment?.id || null,
        solicitacao_exame_id: normalizeString(prontuario.solicitacao_exame_id) || null,
        data: dateTime.data,
        horario: dateTime.horario,
        tipo_atendimento: tipoAtendimento,
        categoria: resolveCategory(serviceCode, tipoAtendimento),
        status: resolveStatus({
          plano,
          serviceCode,
          consultaStatus: normalizeString(consulta?.status),
          appointmentStatus: normalizeString(appointment?.status),
        }),
        profissional_nome: normalizeString(appointment?.professional_name || consulta?.profissional_nome),
        especialidade: normalizeString(appointment?.specialty || consulta?.especialidade),
        plano: plano || null,
        service_code: serviceCode,
        created_at: prontuario.created_date || '',
        updated_at: prontuario.updated_at || '',
      };
    })
    .sort((left, right) => {
      const leftTime = Date.parse(left.updated_at || left.created_at || '');
      const rightTime = Date.parse(right.updated_at || right.created_at || '');
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    })
    .slice(0, limit);

  return { items };
}

export async function handleGetPatientProntuariosRequest(req: Request) {
  const preflightResponse = handlePreflight(req, CORS);
  if (preflightResponse) return preflightResponse;

  const requestId = createRequestId();
  const methodErrorResponse = ensureMethod(req, {
    allowedMethods: ['POST'],
    functionName: FUNCTION_NAME,
    requestId,
    cors: CORS,
  });
  if (methodErrorResponse) return methodErrorResponse;

  try {
    const body = await readJsonBody<RequestBody>(req);
    const client = createServiceRoleClient();
    const authenticatedUser = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
    const appUser = await requireAppUserByAuthUserId(client, authenticatedUser.authUserId);

    requireRole(appUser, ['patient']);

    const result = await getPatientProntuarios({
      client,
      patientId: appUser.id,
      limit: normalizeLimit(body?.limit),
    });

    return successResponse(result, requestId, { status: 200, cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}

Deno.serve(handleGetPatientProntuariosRequest);
