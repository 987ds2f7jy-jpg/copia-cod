import { requireAuthenticatedUser } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { createRequestId, ensureMethod, errorResponse, handlePreflight, readJsonBody, successResponse } from '../_shared/http.ts';
import type { CorsOptions } from '../_shared/http.ts';
import { insertAuditEvent, logTechnicalEvent } from '../_shared/observability.ts';
import { requireAppUserByAuthUserId } from '../_shared/professional.ts';
import { requireRecord } from '../_shared/privacy-rights.ts';
import { createServiceRoleClient, createSupabaseAuthUserLookup, type SupabaseClient } from '../_shared/supabase.ts';

const FUNCTION_NAME = 'generate-my-privacy-data-export';
const BUCKET = 'privacy-exports';
const MAX_EXPORT_BYTES = 5 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 5 * 60;
const CORS: CorsOptions = { allowedMethods: ['POST'] };

async function rows(client: SupabaseClient, table: string, projection: string, filter: { column: string; value: string }) {
  const { data, error } = await client.from(table).select(projection).eq(filter.column, filter.value).limit(1000);
  if (error) throw new AppError({ status: 500, code: 'PRIVACY_EXPORT_QUERY_FAILED', message: `Unable to export ${table}.` });
  return data || [];
}

async function buildPatientExport(client: SupabaseClient, userId: string) {
  const appointments = await rows(client, 'appointments', 'id, professional_id, professional_name, specialty, appointment_type, scheduled_datetime, date, time, status, price, symptoms, notes, cancellation_reason, consulta_id, funding_source, coverage_status, created_date, updated_at', { column: 'patient_id', value: userId });
  const queues = await rows(client, 'queues', 'id, specialty, priority_level, status, position, estimated_wait_time, assigned_professional_id, consulta_id, funding_source, coverage_status, created_date, updated_at', { column: 'patient_id', value: userId });
  const requests = await rows(client, 'solicitacoes_exames', 'id, tipo, exame_solicitado, motivo, sintomas, status, fluxo_destino, especialidade_destino, assintomatico_confirmado, medico_id, consulta_id, completed_at, created_date, updated_at', { column: 'paciente_id', value: userId });
  const consultations = await rows(client, 'consultas', 'id, profissional_id, profissional_nome, especialidade, tipo_consulta, status, datetime, descricao_sintomas, inicio_at, fim_at, preco, created_date, updated_at', { column: 'paciente_id', value: userId });
  const medicalRecords = await rows(client, 'prontuarios', 'id, consulta_id, profissional_id, modo, motivo_consulta, historico_risco, exames_imagem, exame_fisico, avaliacao_diagnostico, recomendacoes, solicitacao_exame_id, created_date, updated_at', { column: 'paciente_id', value: userId });
  const planOrdersResult = await client.from('plan_subscription_orders')
    .select('id, plan_code, external_plan_id, amount, currency, status, payment_status, payment_required, paid_at, activated_at, created_at, updated_at')
    .or(`patient_id.eq.${userId},app_user_id.eq.${userId}`).limit(1000);
  if (planOrdersResult.error) throw new AppError({ status: 500, code: 'PRIVACY_EXPORT_QUERY_FAILED', message: 'Unable to export plan subscriptions.' });
  const creditUsages = await rows(client, 'plan_credit_usages', 'id, owner_type, owner_id, appointment_id, plan_subscription_order_id, plans_service_subscription_id, external_subscription_score_id, external_score_id, external_plan_id, external_specialization_id, specialty_code, status, used_at, created_at, updated_at', { column: 'patient_id', value: userId });

  const ownerGroups = [
    ['appointment', appointments.map((item: Record<string, unknown>) => String(item.id))],
    ['queue', queues.map((item: Record<string, unknown>) => String(item.id))],
    ['solicitacao_exame', requests.map((item: Record<string, unknown>) => String(item.id))],
    ['plan_subscription', (planOrdersResult.data || []).map((item: Record<string, unknown>) => String(item.id))],
  ] as const;
  const payments: unknown[] = [];
  for (const [ownerType, ownerIds] of ownerGroups) {
    if (ownerIds.length === 0) continue;
    const { data, error } = await client.from('payment_charges')
      .select('id, owner_type, owner_id, attempt_number, provider, status, amount, currency, created_at, updated_at, expires_at, paid_at, failed_at, expired_at, refunded_at, chargeback_at')
      .eq('owner_type', ownerType).in('owner_id', ownerIds).limit(1000);
    if (error) throw new AppError({ status: 500, code: 'PRIVACY_EXPORT_QUERY_FAILED', message: 'Unable to export payments.' });
    payments.push(...(data || []));
  }

  return {
    appointments,
    queues,
    serviceRequests: requests,
    consultations,
    medicalRecords,
    payments,
    planSubscriptions: planOrdersResult.data || [],
    planCreditUsages: creditUsages,
  };
}

async function buildProfessionalExport(client: SupabaseClient, userId: string) {
  const profiles = await rows(client, 'professional_profiles', 'id, full_name, profession, specialty, register_number, register_state, rqe, university, graduation_year, sex, phone, cpf, bio, price_standard, price_priority, is_on_duty, available_days, available_hours, is_verified, status, perfil_ativo, prioritario_ativo, created_date, updated_at', { column: 'user_id', value: userId });
  const profileIds = profiles.map((profile: Record<string, unknown>) => String(profile.id));
  let bankingData: unknown[] = [];
  let withdrawals: unknown[] = [];
  if (profileIds.length > 0) {
    const banking = await client.from('professional_banking_data')
      .select('id, professional_id, tipo_pessoa, nome_titular, cpf_cnpj, tipo_recebimento, tipo_chave_pix, chave_pix, banco, agencia, conta, digito_conta, tipo_conta, razao_social, created_date, updated_at')
      .in('professional_id', profileIds).limit(100);
    if (banking.error) throw new AppError({ status: 500, code: 'PRIVACY_EXPORT_QUERY_FAILED', message: 'Unable to export professional banking data.' });
    bankingData = banking.data || [];
    const payoutResult = await client.from('saques')
      .select('id, professional_id, valor, status, data_solicitacao, data_processamento, metodo, observacao, created_date, updated_at')
      .in('professional_id', profileIds).limit(1000);
    if (payoutResult.error) throw new AppError({ status: 500, code: 'PRIVACY_EXPORT_QUERY_FAILED', message: 'Unable to export withdrawals.' });
    withdrawals = payoutResult.data || [];
  }
  const consultationResult = await client.from('consultas')
    .select('id, especialidade, tipo_consulta, status, datetime, inicio_at, fim_at, created_date, updated_at')
    .eq('profissional_user_id', userId).limit(1000);
  if (consultationResult.error) throw new AppError({ status: 500, code: 'PRIVACY_EXPORT_QUERY_FAILED', message: 'Unable to export professional consultation metadata.' });
  return { professionalProfiles: profiles, bankingData, withdrawals, consultationMetadata: consultationResult.data || [] };
}

async function handler(req: Request) {
  const preflight = handlePreflight(req, CORS); if (preflight) return preflight;
  const requestId = createRequestId();
  const methodError = ensureMethod(req, { allowedMethods: ['POST'], functionName: FUNCTION_NAME, requestId, cors: CORS });
  if (methodError) return methodError;
  const startedAt = Date.now();
  try {
    const client = createServiceRoleClient();
    const authenticated = await requireAuthenticatedUser(req, createSupabaseAuthUserLookup(client));
    const user = await requireAppUserByAuthUserId(client, authenticated.authUserId);
    const body = requireRecord(await readJsonBody<unknown>(req));
    const privacyRequestId = String(body.requestId ?? '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(privacyRequestId)) throw new AppError({ status: 422, code: 'PRIVACY_REQUEST_ID_INVALID', message: 'Invalid privacy request identifier.' });
    const requestProjection = 'id, requester_user_id, request_type, status, export_storage_path, export_expires_at, review_version';
    const { data: privacyRequest, error: requestError } = await client.from('privacy_rights_requests')
      .select(requestProjection).eq('id', privacyRequestId).eq('requester_user_id', user.id).eq('request_type', 'export').maybeSingle();
    if (requestError) throw new AppError({ status: 500, code: 'PRIVACY_EXPORT_REQUEST_LOOKUP_FAILED', message: 'Unable to validate export request.' });
    if (!privacyRequest) throw new AppError({ status: 404, code: 'PRIVACY_EXPORT_REQUEST_NOT_FOUND', message: 'Export request not found.' });
    if (privacyRequest.status === 'canceled' || privacyRequest.status === 'rejected') throw new AppError({ status: 409, code: 'PRIVACY_EXPORT_REQUEST_CLOSED', message: 'This export request cannot be processed.' });
    if (privacyRequest.export_storage_path) {
      const signedExisting = await client.storage.from(BUCKET)
        .createSignedUrl(privacyRequest.export_storage_path, SIGNED_URL_TTL_SECONDS, { download: 'rapido-doutor-data-export.json' });
      if (signedExisting.error || !signedExisting.data?.signedUrl) throw new AppError({ status: 500, code: 'PRIVACY_EXPORT_SIGN_FAILED', message: 'Unable to create temporary export link.' });
      return successResponse({
        requestId: privacyRequestId,
        format: 'json',
        downloadUrl: signedExisting.data.signedUrl,
        expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
        reused: true,
      }, requestId, { cors: CORS });
    }

    const accountResult = await client.from('app_users').select('id, full_name, email, role, is_active, phone, cpf, birth_date, sex, address, city, state, profile_complete, created_date, updated_at, deactivated_at, deactivation_reason_code').eq('id', user.id).single();
    if (accountResult.error) throw new AppError({ status: 500, code: 'PRIVACY_EXPORT_ACCOUNT_FAILED', message: 'Unable to export account data.' });
    const patientProfile = user.role === 'patient'
      ? await rows(client, 'patient_profiles', 'id, cpf, phone, birth_date, sex, created_date, updated_at', { column: 'user_id', value: user.id })
      : [];
    const legalEvents = await rows(client, 'legal_user_events', 'id, document_key, document_version, event_type, occurred_at, source, locale, created_at', { column: 'user_id', value: user.id });
    const consentEvents = await rows(client, 'consultation_consent_events', 'id, consulta_id, consent_key, document_version, decision, occurred_at, source, created_at', { column: 'patient_user_id', value: user.id });
    const privacyRequests = await rows(client, 'privacy_rights_requests', 'id, request_type, status, description, decision_code, public_response, submitted_at, completed_at, created_at, updated_at', { column: 'requester_user_id', value: user.id });
    const roleData = user.role === 'patient'
      ? await buildPatientExport(client, user.id)
      : user.role === 'professional'
        ? await buildProfessionalExport(client, user.id)
        : {};

    const document = {
      schemaVersion: '1.0',
      generatedAt: new Date().toISOString(),
      subjectUserId: user.id,
      account: accountResult.data,
      patientProfile,
      legalEvents,
      consultationConsentEvents: consentEvents,
      privacyRightsRequests: privacyRequests,
      ...roleData,
      exclusions: ['provider_payloads', 'internal_admin_notes', 'security_and_antifraud_logs', 'third_party_clinical_data'],
    };
    const json = JSON.stringify(document, null, 2);
    const byteLength = new TextEncoder().encode(json).byteLength;
    if (byteLength > MAX_EXPORT_BYTES) throw new AppError({ status: 413, code: 'PRIVACY_EXPORT_TOO_LARGE', message: 'Export exceeds the synchronous staging limit and requires assisted processing.' });

    const storagePath = `${user.id}/${privacyRequestId}/rapido-doutor-data-export.json`;
    const upload = await client.storage.from(BUCKET).upload(storagePath, new Blob([json], { type: 'application/json' }), { contentType: 'application/json', upsert: true, cacheControl: '0' });
    if (upload.error) throw new AppError({ status: 500, code: 'PRIVACY_EXPORT_UPLOAD_FAILED', message: 'Unable to store privacy export.' });
    const signed = await client.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, { download: 'rapido-doutor-data-export.json' });
    if (signed.error || !signed.data?.signedUrl) throw new AppError({ status: 500, code: 'PRIVACY_EXPORT_SIGN_FAILED', message: 'Unable to create temporary export link.' });
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
    const { error: updateError } = await client.from('privacy_rights_requests').update({
      status: 'completed', decision_code: 'request_fulfilled',
      public_response: 'Exportacao disponibilizada ao titular por link temporario.',
      completed_at: new Date().toISOString(), export_storage_path: storagePath,
      export_expires_at: expiresAt, review_version: Number(privacyRequest.review_version || 0) + 1,
    }).eq('id', privacyRequestId).eq('requester_user_id', user.id);
    if (updateError) throw new AppError({ status: 500, code: 'PRIVACY_EXPORT_STATE_FAILED', message: 'Export was created but its request state could not be finalized.' });
    await insertAuditEvent(client, { actorUserId: user.id, actorRole: user.role, action: 'privacy_export.generated', resourceType: 'privacy_rights_request', resourceId: privacyRequestId, outcome: 'succeeded', requestId, metadata: { request_type: 'export', request_status: 'completed', export_format: 'json' } });
    logTechnicalEvent('info', { functionName: FUNCTION_NAME, requestId, operation: 'privacy_export.generate', actorId: user.id, actorRole: user.role, resourceType: 'privacy_rights_request', resourceId: privacyRequestId, status: 'succeeded', durationMs: Date.now() - startedAt });
    return successResponse({ requestId: privacyRequestId, format: 'json', downloadUrl: signed.data.signedUrl, expiresAt, sizeBytes: byteLength, reused: false }, requestId, { cors: CORS });
  } catch (error) { return errorResponse(error, { requestId, functionName: FUNCTION_NAME, cors: CORS }); }
}

export const generateMyPrivacyDataExportHandler = handler;
Deno.serve(handler);
