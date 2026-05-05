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

const FUNCTION_NAME = 'get-patient-payments';
const CORS: CorsOptions = { allowedMethods: ['POST'] };
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 300;

type RequestBody = {
  limit?: number;
};

type OwnerType = 'appointment' | 'queue' | 'solicitacao_exame';

type PaymentStatus =
  | 'payment_pending'
  | 'payment_processing'
  | 'paid'
  | 'payment_failed'
  | 'payment_expired'
  | 'refunded'
  | 'chargeback';

type OwnerMetadata = {
  owner_type: OwnerType;
  id: string;
  current_payment_charge_id: string | null;
  service_code: string;
  specialty: string;
  professional_name: string;
  patient_name: string;
  operational_status: string;
  created_at: string;
  updated_at: string;
};

type AppointmentRow = {
  id: string;
  current_payment_charge_id: string | null;
  service_code: string | null;
  appointment_type: string | null;
  specialty: string | null;
  professional_name: string | null;
  patient_name: string | null;
  status: string | null;
  created_date: string | null;
  updated_at: string | null;
};

type QueueRow = {
  id: string;
  current_payment_charge_id: string | null;
  service_code: string | null;
  specialty: string | null;
  patient_name: string | null;
  status: string | null;
  created_date: string | null;
  updated_at: string | null;
};

type SolicitacaoExameRow = {
  id: string;
  current_payment_charge_id: string | null;
  service_code: string | null;
  tipo: string | null;
  especialidade_destino: string | null;
  paciente_nome: string | null;
  status: string | null;
  created_date: string | null;
  updated_at: string | null;
};

type PaymentChargeRow = {
  id: string;
  owner_type: OwnerType;
  owner_id: string;
  attempt_number: number | null;
  provider: string | null;
  status: PaymentStatus;
  amount: number | string | null;
  currency: string | null;
  external_reference: string | null;
  provider_checkout_url: string | null;
  failure_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
  expires_at: string | null;
  paid_at: string | null;
  failed_at: string | null;
  expired_at: string | null;
  refunded_at: string | null;
  chargeback_at: string | null;
};

const RESUMABLE_STATUSES = new Set<PaymentStatus>([
  'payment_pending',
  'payment_processing',
]);

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

function parseMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
}

function resolveServiceLabel(serviceCode: string, fallback = '') {
  const normalizedService = serviceCode.toLowerCase();
  const labels: Record<string, string> = {
    profile_standard: 'Consulta por perfil',
    profile_priority: 'Consulta prioritária',
    specialty_request: 'Consulta por especialidade',
    on_duty_clinico_geral: 'Plantão - Clínico Geral',
    on_duty_pediatria: 'Plantão - Pediatria',
    on_duty_psicologia: 'Plantão - Psicologia',
    on_duty_psiquiatria: 'Plantão - Psiquiatria',
    extra_checkup: 'Check-up',
    extra_exames_especificos: 'Exames específicos',
    extra_renovacao_receitas: 'Renovação de receita',
    extra_laudo_medico: 'Laudo médico',
  };

  if (labels[normalizedService]) {
    return labels[normalizedService];
  }

  const normalizedFallback = fallback.toLowerCase();
  if (normalizedFallback.includes('checkup') || normalizedFallback.includes('check-up')) {
    return 'Check-up';
  }
  if (normalizedFallback.includes('renovacao') || normalizedFallback.includes('receita')) {
    return 'Renovação de receita';
  }
  if (normalizedFallback.includes('laudo')) {
    return 'Laudo médico';
  }
  if (normalizedFallback.includes('exame')) {
    return 'Exames específicos';
  }

  return fallback || 'Pagamento';
}

function paymentSortTime(row: PaymentChargeRow) {
  const candidates = [
    row.paid_at,
    row.failed_at,
    row.expired_at,
    row.refunded_at,
    row.chargeback_at,
    row.updated_at,
    row.created_at,
  ];

  for (const value of candidates) {
    const parsed = Date.parse(value || '');
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function summarize(items: Array<{ status: PaymentStatus; amount: number }>) {
  return items.reduce((summary, item) => {
    if (item.status === 'paid') {
      summary.total_paid += item.amount;
    }

    if (item.status === 'payment_pending' || item.status === 'payment_processing') {
      summary.total_pending += item.amount;
    }

    if (
      item.status === 'payment_failed' ||
      item.status === 'payment_expired' ||
      item.status === 'chargeback'
    ) {
      summary.total_failed += item.amount;
    }

    return summary;
  }, {
    total_paid: 0,
    total_pending: 0,
    total_failed: 0,
    count: items.length,
  });
}

function mapAppointmentOwner(row: AppointmentRow): OwnerMetadata {
  return {
    owner_type: 'appointment',
    id: row.id,
    current_payment_charge_id: row.current_payment_charge_id || null,
    service_code: normalizeString(row.service_code),
    specialty: normalizeString(row.specialty),
    professional_name: normalizeString(row.professional_name),
    patient_name: normalizeString(row.patient_name),
    operational_status: normalizeString(row.status),
    created_at: normalizeString(row.created_date),
    updated_at: normalizeString(row.updated_at),
  };
}

function mapQueueOwner(row: QueueRow): OwnerMetadata {
  return {
    owner_type: 'queue',
    id: row.id,
    current_payment_charge_id: row.current_payment_charge_id || null,
    service_code: normalizeString(row.service_code),
    specialty: normalizeString(row.specialty),
    professional_name: '',
    patient_name: normalizeString(row.patient_name),
    operational_status: normalizeString(row.status),
    created_at: normalizeString(row.created_date),
    updated_at: normalizeString(row.updated_at),
  };
}

function mapSolicitacaoOwner(row: SolicitacaoExameRow): OwnerMetadata {
  return {
    owner_type: 'solicitacao_exame',
    id: row.id,
    current_payment_charge_id: row.current_payment_charge_id || null,
    service_code: normalizeString(row.service_code),
    specialty: normalizeString(row.especialidade_destino),
    professional_name: '',
    patient_name: normalizeString(row.paciente_nome),
    operational_status: normalizeString(row.status),
    created_at: normalizeString(row.created_date),
    updated_at: normalizeString(row.updated_at),
  };
}

async function listAppointmentOwners(client: SupabaseClient, patientId: string, limit: number) {
  const { data, error } = await client
    .from('appointments')
    .select(`
      id,
      current_payment_charge_id,
      service_code,
      appointment_type,
      specialty,
      professional_name,
      patient_name,
      status,
      created_date,
      updated_at
    `)
    .eq('patient_id', patientId)
    .order('created_date', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PATIENT_PAYMENT_APPOINTMENTS_LOOKUP_FAILED',
      message: 'Unable to load patient payment appointments.',
      details: error.message,
    });
  }

  return ((data as AppointmentRow[] | null) || []).map(mapAppointmentOwner);
}

async function listQueueOwners(client: SupabaseClient, patientId: string, limit: number) {
  const { data, error } = await client
    .from('queues')
    .select(`
      id,
      current_payment_charge_id,
      service_code,
      specialty,
      patient_name,
      status,
      created_date,
      updated_at
    `)
    .eq('patient_id', patientId)
    .order('created_date', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PATIENT_PAYMENT_QUEUES_LOOKUP_FAILED',
      message: 'Unable to load patient payment queues.',
      details: error.message,
    });
  }

  return ((data as QueueRow[] | null) || []).map(mapQueueOwner);
}

async function listSolicitacaoOwners(client: SupabaseClient, patientId: string, limit: number) {
  const { data, error } = await client
    .from('solicitacoes_exames')
    .select(`
      id,
      current_payment_charge_id,
      service_code,
      tipo,
      especialidade_destino,
      paciente_nome,
      status,
      created_date,
      updated_at
    `)
    .eq('paciente_id', patientId)
    .order('created_date', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PATIENT_PAYMENT_SOLICITACOES_LOOKUP_FAILED',
      message: 'Unable to load patient payment service requests.',
      details: error.message,
    });
  }

  return ((data as SolicitacaoExameRow[] | null) || []).map(mapSolicitacaoOwner);
}

async function listChargesForOwnerType(
  client: SupabaseClient,
  ownerType: OwnerType,
  ownerIds: string[],
) {
  if (ownerIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from('payment_charges')
    .select(`
      id,
      owner_type,
      owner_id,
      attempt_number,
      provider,
      status,
      amount,
      currency,
      external_reference,
      provider_checkout_url,
      failure_reason,
      created_at,
      updated_at,
      expires_at,
      paid_at,
      failed_at,
      expired_at,
      refunded_at,
      chargeback_at
    `)
    .eq('owner_type', ownerType)
    .in('owner_id', ownerIds);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'PATIENT_PAYMENT_CHARGES_LOOKUP_FAILED',
      message: 'Unable to load patient payment history.',
      details: error.message,
    });
  }

  return (data as PaymentChargeRow[] | null) || [];
}

async function getPatientPayments({
  client,
  patientId,
  limit,
}: {
  client: SupabaseClient;
  patientId: string;
  limit: number;
}) {
  const [appointments, queues, solicitacoes] = await Promise.all([
    listAppointmentOwners(client, patientId, limit),
    listQueueOwners(client, patientId, limit),
    listSolicitacaoOwners(client, patientId, limit),
  ]);

  const owners = [...appointments, ...queues, ...solicitacoes];
  const ownerByKey = new Map(
    owners.map((owner) => [`${owner.owner_type}:${owner.id}`, owner]),
  );

  const [appointmentCharges, queueCharges, solicitacaoCharges] = await Promise.all([
    listChargesForOwnerType(client, 'appointment', appointments.map((owner) => owner.id)),
    listChargesForOwnerType(client, 'queue', queues.map((owner) => owner.id)),
    listChargesForOwnerType(client, 'solicitacao_exame', solicitacoes.map((owner) => owner.id)),
  ]);

  const items = [...appointmentCharges, ...queueCharges, ...solicitacaoCharges]
    .map((charge) => {
      const owner = ownerByKey.get(`${charge.owner_type}:${charge.owner_id}`);

      if (!owner) {
        return null;
      }

      const amount = parseMoney(charge.amount);
      const status = charge.status || 'payment_pending';
      const serviceType = resolveServiceLabel(owner.service_code);

      return {
        id: charge.id,
        owner_type: charge.owner_type,
        owner_id: charge.owner_id,
        attempt_number: Number(charge.attempt_number || 1),
        is_current: Boolean(owner.current_payment_charge_id && owner.current_payment_charge_id === charge.id),
        status,
        amount,
        currency: normalizeString(charge.currency) || 'BRL',
        provider: normalizeString(charge.provider),
        checkout_url: RESUMABLE_STATUSES.has(status) ? normalizeString(charge.provider_checkout_url) : '',
        external_reference: normalizeString(charge.external_reference),
        failure_reason: normalizeString(charge.failure_reason),
        created_at: normalizeString(charge.created_at),
        updated_at: normalizeString(charge.updated_at),
        paid_at: normalizeString(charge.paid_at),
        failed_at: normalizeString(charge.failed_at),
        expires_at: normalizeString(charge.expires_at),
        expired_at: normalizeString(charge.expired_at),
        refunded_at: normalizeString(charge.refunded_at),
        chargeback_at: normalizeString(charge.chargeback_at),
        service_code: owner.service_code,
        service_type: serviceType,
        specialty: owner.specialty,
        professional_name: owner.professional_name,
        patient_name: owner.patient_name,
        operational_status: owner.operational_status,
        owner_created_at: owner.created_at,
        owner_updated_at: owner.updated_at,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = paymentSortTime(left as PaymentChargeRow);
      const rightTime = paymentSortTime(right as PaymentChargeRow);
      return rightTime - leftTime;
    })
    .slice(0, limit);

  return {
    items,
    summary: summarize(items as Array<{ status: PaymentStatus; amount: number }>),
  };
}

export async function handleGetPatientPaymentsRequest(req: Request) {
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

    const result = await getPatientPayments({
      client,
      patientId: appUser.id,
      limit: normalizeLimit(body?.limit),
    });

    return successResponse(result, requestId, { status: 200, cors: CORS });
  } catch (error) {
    return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS });
  }
}

Deno.serve(handleGetPatientPaymentsRequest);
