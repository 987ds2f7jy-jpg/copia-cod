# Notification Events Map

Status: Phase 1, scoped Phase 2, safe Phase 3A, and scoped Phase 3B events are implemented; remaining scheduler/fan-out events stay mapped only.

Code reviewed: 2026-09-23

## Objective

Map the real domain points where `InternalNotificationService` is or may be called. This document identifies the durable success point, recipient, related entity, and idempotency key for each event while preserving existing business rules.

The map distinguishes between:

- flows that already expose a safe post-success integration point;
- flows whose recipient or deployed schema still needs verification;
- flows that exist but require a product/business decision before notification;
- expected flows that were not found in the repository;
- flows already integrated with `InternalNotificationService`.

## Current Notification Infrastructure

The repository currently contains:

- tables `notification_types`, `user_notifications`, and `notification_deliveries`;
- the central service `supabase/functions/_shared/notifications/InternalNotificationService.ts`;
- the Edge Functions `notifications-list`, `notifications-unread-count`, `notifications-mark-read`, and `notifications-mark-all-read`;
- the patient/professional notification center under `src/notifications/`;
- unread counters and badges in the authenticated application layout;
- seeded type keys in `supabase/migrations/20260912090000_create_internal_notifications.sql`.

The infrastructure is partially implemented. Phase 1, scoped Phase 2, safe Phase 3A, and scoped Phase 3B flows call `InternalNotificationService` from appointment, payment, review, professional-registration, clinical-request, teleconsultation, queue, withdrawal, plan, and scheduled-reminder flows. Remaining events are mapped for future work.

The repository contains the protected `notifications-dispatch-scheduled` dispatcher but does not contain `notification_preferences`. The existing central service currently creates only the internal channel delivery. The remote Supabase Cron job is an environment operation and is not represented as an active job by repository state alone.

## Event Map

Status values in this table have the following meaning:

- `ready_to_integrate`: a durable success point, recipient path, entity ID, and existing type key were found;
- `needs_schema_verification`: a likely point exists, but the result contract or deployed relationship needed to obtain the recipient is not sufficient by itself;
- `needs_business_rule_verification`: code exists, but notification timing, audience, fan-out, or meaning is not defined clearly enough;
- `not_found`: the expected state transition or scheduler was not found;
- `already_integrated`: the flow invokes the central service after the authoritative state change.

| Domain | Event | Trigger point found in code | Suggested typeKey | Recipient | Related entity | Deduplication key | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| Appointment | Patient creates a new appointment | After `repository.createAppointment(...)` succeeds in `supabase/functions/create-appointment/service.ts::createAppointment` | `appointment.created` | Patient `appUser.id` | `appointment` / `appointment.id` | `appointment:{appointmentId}:created:patient:{patientUserId}` | `already_integrated` | Emitted only after plan-funded or self-pay persistence succeeds. |
| Appointment | A directly selected professional receives an appointment | Same successful return in `createAppointment`; `findProfessionalTargetById` exposes `professional.appUserId` | `appointment.received` | Selected professional app user | `appointment` / `appointment.id` | `appointment:{appointmentId}:received:professional:{professionalUserId}` | `already_integrated` | Applies only to profile-targeted appointments; no specialty fan-out was added. |
| Appointment | Eligible professionals receive an open specialty appointment | Same creation point in `createAppointment`, but no final recipient set is selected | `appointment.received` | Eligible/on-duty professionals for the specialty | `appointment` / `appointment.id` | `appointment:{appointmentId}:received:professional:{professionalUserId}` | `needs_business_rule_verification` | Define eligibility, fan-out limits, off-duty behavior, and whether late-joining professionals should be notified. |
| Appointment | Professional accepts an appointment | After a new `repository.acceptAppointment(...)` transaction succeeds in `supabase/functions/accept-appointment/service.ts::acceptAppointment` | `appointment.accepted` | Appointment patient | `appointment` / `appointmentId` | `appointment:{appointmentId}:accepted:patient:{patientUserId}` | `already_integrated` | The acceptance-window lookup now selects `appointments.patient_id`; the already-accepted path does not emit. |
| Appointment | Professional rejects an appointment | No rejection service, endpoint, or durable rejection transition was found | — (not seeded) | Appointment patient | `appointment` | — | `not_found` | The catalog also has no appointment-rejected type key. Do not reinterpret cancellation as rejection. |
| Appointment | Patient cancels an appointment | After `repository.cancelAppointment(...)` succeeds in `supabase/functions/cancel-appointment/service.ts::cancelAppointment` | `appointment.cancelled` | Assigned counterpart professional | `appointment` / `appointmentId` | `appointment:{appointmentId}:cancelled:professional:{professionalUserId}` | `already_integrated` | The professional profile is resolved to `professional_profiles.user_id` after cancellation. No actor confirmation or emission for unassigned appointments. |
| Appointment | Professional cancels an appointment | Same successful cancellation transaction in `cancelAppointment` | `appointment.cancelled` | Appointment patient | `appointment` / `appointmentId` | `appointment:{appointmentId}:cancelled:patient:{patientUserId}` | `already_integrated` | Emits only after cancellation/credit release succeeds. Administrative cancellation has no notification rule and does not emit. |
| Appointment | Day-of appointment reminder | Daily execution of `supabase/functions/notifications-dispatch-scheduled` | `appointment.reminder_day` | Patient and assigned professional, when one exists | `appointment` / appointment ID | `appointment:{appointmentId}:reminder_day:{recipientRole}:{recipientUserId}` | `already_integrated` | Protected by an internal secret; local date/time use `America/Sao_Paulo`; retry is absorbed by the stable recipient-specific key. |
| Appointment | One-hour appointment reminder | No notification scheduler or reminder worker was found | `appointment.reminder_1h` | Patient and/or professional | `appointment` / appointment ID | `appointment:{appointmentId}:reminder_1h:{recipientUserId}` | `not_found` | Requires the same scheduler decisions as the day reminder. |
| Appointment | Ten-minute appointment reminder | No notification scheduler or reminder worker was found | `appointment.reminder_10m` | Patient and/or professional | `appointment` / appointment ID | `appointment:{appointmentId}:reminder_10m:{recipientUserId}` | `not_found` | Requires the same scheduler decisions as the day reminder. |
| Appointment | Appointment can start | No explicit notification trigger was found; only consultation scheduling/deadline helpers exist | `appointment.starting` | Patient and/or professional | `appointment` or `consulta` | `appointment:{appointmentId}:starting:{recipientUserId}` | `not_found` | Define the start window and whether this is distinct from `teleconsulta.room_available`. |
| Payment | A new payment charge is created | After provider charge creation, owner attachment, and provider-response persistence in `supabase/functions/_shared/payments/create-payment-charge.ts::createPaymentCharge` | `financial.payment_created` | Owner patient/app user | `payment_charge` / charge ID | `payment_charge:{paymentChargeId}:created:{recipientUserId}` | `needs_schema_verification` | Resolve the recipient from the owner (`appointment`, `queue`, `solicitacao_exame`, or `plan_subscription`). Do not emit when an existing pending charge is reused. |
| Payment | Payment is confirmed as paid by the gateway | When `supabase/functions/payments-webhook/handler.ts::applyProviderStatus` actually applies `nextStatus === 'paid'`, after owner status updates | `financial.payment_approved` | Charge owner patient/app user | `payment_charge` / charge ID | `payment_charge:{paymentChargeId}:approved:{recipientUserId}` | `already_integrated` | The recipient is resolved by owner type. No gateway payload is copied into notification data. |
| Payment | Local/test payment simulation marks payment paid | After a real transition in `supabase/functions/_shared/payments/mark-payment-as-paid.ts::markPaymentAsPaid`, called by `simulate-payment-paid` | `financial.payment_approved` | Charge owner patient/app user | `payment_charge` / charge ID | `payment_charge:{paymentChargeId}:approved:{recipientUserId}` | `already_integrated` | Shares the webhook key and does not emit from the already-paid repair path. |
| Payment | Gateway reports payment failure | When `applyProviderStatus` applies `payment_failed` in the payments webhook | `financial.payment_failed` | Charge owner patient/app user | `payment_charge` / charge ID | `payment_charge:{paymentChargeId}:failed:{recipientUserId}` | `already_integrated` | Covers only an applied webhook transition; provider-creation failure remains unintegrated. |
| Payment | Charge expires | When `applyProviderStatus` applies `payment_expired` in the payments webhook | `financial.payment_expired` | Charge owner patient/app user | `payment_charge` / charge ID | `payment_charge:{paymentChargeId}:expired:{recipientUserId}` | `already_integrated` | No independent charge-expiration job was added. |
| Payment | Refund is confirmed | When `applyProviderStatus` applies `refunded` in the payments webhook | `financial.refund_processed` | Charge owner patient/app user | `payment_charge` / charge ID | `payment_charge:{paymentChargeId}:refunded:{recipientUserId}` | `already_integrated` | Emits only from the confirmed persisted transition, never from a refund request. |
| Payment | Chargeback is confirmed | `applyProviderStatus` supports a `chargeback` transition | — (not seeded) | Charge owner patient/app user | `payment_charge` / charge ID | — | `needs_schema_verification` | A real transition exists, but the notification catalog has no chargeback type key. |
| Teleconsultation | Room becomes available | A `consulta` is created by appointment or queue acceptance transactions, but no explicit “room available” transition was found | `teleconsulta.room_available` | Patient and professional | `consulta` / consultation ID | `consulta:{consultaId}:room_available:{recipientUserId}` | `needs_business_rule_verification` | Decide whether availability begins at acceptance, at the allowed start window, or when the professional starts the session. |
| Teleconsultation | Professional starts consultation | After the atomic transition succeeds in `supabase/functions/start-consulta-session/service.ts::startConsultaSession` | `teleconsulta.started` | Consultation patient | `consulta` / consultation ID | `consulta:{consultaId}:started:patient:{patientUserId}` | `already_integrated` | Emits only for a new transition to `em_atendimento`, not an idempotent room-state repair. |
| Teleconsultation | Consultation finishes | After consultation, linked appointment/queue, and required medical-record updates succeed in `supabase/functions/finish-consulta/service.ts::finishConsulta` | `teleconsulta.finished` | Consultation patient | `consulta` / consultation ID | `consulta:{consultaId}:finished:patient:{patientUserId}` | `already_integrated` | Emits only for a new transition to `finalizada`, separately from `review.professional_pending`. |
| Teleconsultation | Record/document becomes available | `finishConsulta` requires a prontuário, and `upsert-prontuario` can create/update it, but no explicit publication/release transition exists | `teleconsulta.record_available` | Consultation patient | `consulta` / consultation ID | `consulta:{consultaId}:record_available:patient:{patientUserId}` | `needs_business_rule_verification` | A saved clinical record is not necessarily a patient-visible document. Define the release event without exposing its contents. |
| Teleconsultation | Scheduled consultation expires without starting | `supabase/functions/expire-overdue-scheduled-consultations/index.ts` expires overdue consultations, but its non-dry-run result is aggregate-only | — (not seeded) | Patient and professional | `consulta` / consultation ID | — | `needs_schema_verification` | The worker/RPC would need affected entity and recipient IDs. There is no matching seeded type key. |
| Review | Finished consultation becomes available for evaluation | At the successful new completion point in `supabase/functions/finish-consulta/service.ts::finishConsulta` | `review.professional_pending` | Consultation patient | `consulta` / consultation ID | `review:{consultaId}:pending:patient:{patientUserId}` | `already_integrated` | Emitted only after a real transition to `finalizada`; already-finalized calls do not emit. |
| Review | Patient submits consultation evaluation | After evaluation creation succeeds in `supabase/functions/submit-consulta-evaluation/service.ts::submitConsultaEvaluation` | `review.received` | Consultation professional (`profissional_user_id`) | `consulta` / consultation ID | `review:{consultaId}:received:professional:{professionalUserId}` | `already_integrated` | Emits immediately after the primary evaluation is durable; optional legacy synchronization remains separate. |
| Review | Patient submits legacy appointment review | After review creation/statistics update in `supabase/functions/submit-appointment-review/service.ts::submitAppointmentReview` | `review.received` | Appointment professional, resolved from profile to app user | `appointment` / appointment ID | `review:appointment:{appointmentId}:received:professional:{professionalUserId}` | `needs_business_rule_verification` | Choose the canonical review flow and deduplicate appointment-linked consultation reviews so the professional is not notified twice. |
| Clinical request | Patient creates request | After repository persistence succeeds in `supabase/functions/create-solicitacao-exame/service.ts::createSolicitacaoExame` | `clinical_request.created` | Patient `appUser.id` | `clinical_request` / request ID | `clinical_request:{requestId}:created:patient:{patientUserId}` | `already_integrated` | Uses generic catalog copy and passes no clinical data. |
| Clinical request | Professional accepts request | After acceptance succeeds in `supabase/functions/accept-solicitacao-exame/service.ts::acceptSolicitacaoExame` | `clinical_request.accepted` | Request patient (`paciente_id`) | `clinical_request` / request ID | `clinical_request:{requestId}:accepted:patient:{patientUserId}` | `already_integrated` | Emits only after a new conditional acceptance; the already-accepted return does not emit. |
| Clinical request | Professional rejects request | No rejection service or durable rejected transition was found | `clinical_request.rejected` | Request patient | `clinical_request` / request ID | `clinical_request:{requestId}:rejected:patient:{patientUserId}` | `not_found` | The type key exists, but `update-solicitacao-exame` explicitly does not perform workflow transitions. |
| Clinical request | Professional completes request | After `finish_solicitacao_exame_atendimento_transaction` succeeds in `supabase/functions/finish-solicitacao-exame-atendimento/service.ts::finishSolicitacaoExameAtendimento` | `clinical_request.completed` | Request patient | `clinical_request` / request ID | `clinical_request:{requestId}:completed:patient:{patientUserId}` | `needs_schema_verification` | The current lookup/result contract does not carry `paciente_id`; fetch or return it from the trusted repository layer. |
| Clinical request | Request document becomes available | The finish transaction returns a prontuário ID, but no explicit document publication/release transition was found | `clinical_request.document_available` | Request patient | `clinical_request` / request ID | `clinical_request:{requestId}:document_available:patient:{patientUserId}` | `needs_business_rule_verification` | Decide which artifact and state count as “available”. Never include document or clinical content. |
| Professional | Professional submits registration | After private and public pending profiles are created in `supabase/functions/register-professional/service.ts::registerProfessional` | `professional.registration_submitted` | Professional `appUser.id` | `professional_profile` / profile ID | `professional_profile:{profileId}:submitted:{professionalUserId}` | `already_integrated` | Emitted only after both profile writes required by the registration flow succeed; duplicate registration attempts stop before notification. |
| Professional | Backoffice approves registration | After the transactional review RPC succeeds in `supabase/functions/backoffice-review-professional/service.ts::reviewBackofficeProfessional` | `professional.registration_approved` | Professional app user resolved from `professional_profiles.user_id` | `professional_profile` / profile ID | `professional_profile:{profileId}:approved:{professionalUserId}` | `already_integrated` | Recipient lookup runs after the pending-only RPC succeeds. |
| Professional | Backoffice rejects registration | Same successful transactional review point in `reviewBackofficeProfessional` | `professional.registration_rejected` | Professional app user resolved from `professional_profiles.user_id` | `professional_profile` / profile ID | `professional_profile:{profileId}:rejected:{professionalUserId}` | `already_integrated` | Internal reason/notes are not passed to notification creation. |
| Professional | Legacy admin approves/rejects registration | After synchronized public/private profile updates in `supabase/functions/review-professional-application/service.ts::reviewProfessionalApplication` | `professional.registration_approved` or `professional.registration_rejected` | Professional app user | `professional_profile` / profile ID | Same profile/action/recipient key as backoffice | `needs_business_rule_verification` | A parallel legacy admin surface still exists. Decide whether it remains authoritative and use the same key to prevent duplicate notifications. |
| Professional | Public profile is published | A possible transition is `perfil_ativo: false -> true` in `supabase/functions/upsert-professional-profile/service.ts::upsertProfessionalProfile` after approved-profile synchronization | `professional.profile_published` | Professional app user | `professional_profile` / profile ID | `professional_profile:{profileId}:published:{professionalUserId}` | `needs_business_rule_verification` | Approval and explicit profile activation have overlapping publication semantics; define the canonical event first. |
| Professional | Profile is suspended | The legacy `reviewProfessionalApplication` flow supports `suspend`; the isolated backoffice review supports only approval/rejection | `professional.profile_suspended` | Professional app user | `professional_profile` / profile ID | `professional_profile:{profileId}:suspended:{professionalUserId}` | `needs_business_rule_verification` | Confirm which admin flow owns suspension and when public visibility is removed. |
| Plan | Paid plan becomes active | After `markOrderActive(...)` succeeds in `supabase/functions/_shared/plans/activate-plan-subscription.ts::activatePlanSubscriptionForPayment` | `plan.activated` | Order app user (`app_user_id` or patient fallback) | `plan` / plan subscription order ID | `plan_order:{orderId}:activated:{recipientUserId}` | `already_integrated` | The stable key is shared by payment confirmation, simulation/reconciliation, and activation retry paths; `already_active` does not emit. |
| Plan | Plan activation fails after payment | After `activatePlanSubscriptionForPayment` successfully persists an activation-failed order state | `plan.activation_failed` | Order app user | `plan` / plan subscription order ID | `plan_order:{orderId}:activation_failed:{recipientUserId}` | `already_integrated` | The Phase 3B migration adds generic copy. The shared key deduplicates webhook, retry, simulation, and reconciliation paths. |
| Plan | Plan is close to expiry | No scheduler or subscription-expiry flow was found in this repository | `plan.expiring` | Plan subscriber | `plan` / subscription/order ID | `plan:{planId}:expiring:{threshold}:{recipientUserId}` | `not_found` | Likely depends on the external plans service plus a scheduled integration. |
| Plan | Plan expires | No local expiration transition or callback was found | `plan.expired` | Plan subscriber | `plan` / subscription/order ID | `plan:{planId}:expired:{recipientUserId}` | `not_found` | Appointment/queue credit release is not plan expiration. |
| Plan | Plan is cancelled | No local subscription-cancellation transition or callback was found | `plan.cancelled` | Plan subscriber | `plan` / subscription/order ID | `plan:{planId}:cancelled:{recipientUserId}` | `not_found` | Appointment/queue cancellation must not emit this event. |
| Plan | Credit is reserved for an appointment | After `create_plan_funded_appointment` returns successfully from `supabase/functions/create-appointment/repository.ts::createAppointment` | `plan.credit_reserved` | Appointment patient | `appointment` / appointment ID | `plan_credit:{usageId}:reserved:patient:{patientUserId}` | `needs_schema_verification` | Prefer the `plan_credit_usages.id` as event identity; verify that the RPC result exposes it, otherwise return it from the trusted repository contract. |
| Plan | Credit is reserved for queue attendance | After `create_plan_funded_queue` returns successfully from `supabase/functions/join-queue/repository.ts::createQueueEntry` | `plan.credit_reserved` | Queue patient | `queue` / queue ID | `plan_credit:{usageId}:reserved:patient:{patientUserId}` | `needs_schema_verification` | Same usage-ID requirement as appointment reservation. |
| Plan | Appointment credit is consumed | After the plans service confirms use and `finalize_plan_credit_usage` succeeds in `supabase/functions/accept-appointment/repository.ts::confirmPlanCreditBeforeAcceptance` | `plan.credit_consumed` | Appointment patient from the acceptance window | `appointment` / appointment ID | `plan_credit:{usageId}:consumed:patient:{patientUserId}` | `already_integrated` | Emits only for `reason === 'used_now'` with the real usage ID; never for `already_used`. |
| Plan | Queue credit is consumed | After `consumePlanCreditOnce(...)` returns `used_now` in `supabase/functions/accept-queue-entry/service.ts::acceptQueueEntry` | `plan.credit_consumed` | Queue `patient_id` | `queue` / queue ID | `plan_credit:{usageId}:consumed:patient:{patientUserId}` | `already_integrated` | The trusted plan context exposes the patient app-user ID; `already_used` does not emit. |
| Plan | Coverage is denied | `check-plan-coverage` and shared coverage resolution return multiple uncovered/fallback reasons | `plan.coverage_denied` | Patient requesting coverage | `plan` or attempted service entity | `plan_coverage:{requestOrEntityId}:denied:patient:{patientUserId}` | `needs_business_rule_verification` | Define which outcomes are genuine denials versus absence of eligibility, unsupported service, no credit, or fallback to self-pay. Avoid notifying on every exploratory coverage check. |
| Queue | Patient joins immediate-care queue | After a newly created `repository.createQueueEntry(...)` succeeds in `supabase/functions/join-queue/service.ts::joinQueue` | `queue.joined` | Patient `appUser.id` | `queue` / queue ID | `queue:{queueId}:joined:patient:{patientUserId}` | `already_integrated` | Existing active entries and the concurrent uniqueness-recovery path do not emit. |
| Queue | Professionals receive a new queue request | Same new-entry success point in `joinQueue` | `queue.request_received` | Eligible/on-duty professionals | `queue` / queue ID | `queue:{queueId}:request_received:professional:{professionalUserId}` | `needs_business_rule_verification` | Current on-duty profile lookup does not expose the final app-user recipient set. Define fan-out and notification-storm controls. |
| Queue | Professional accepts queue attendance | After `repository.acceptQueueEntry(...)` succeeds in `supabase/functions/accept-queue-entry/service.ts::acceptQueueEntry` | `queue.accepted` | Queue patient (`queue_patient_id`) | `queue` / queue ID | `queue:{queueId}:accepted:patient:{patientUserId}` | `already_integrated` | The transaction also creates/returns the consultation; no room-available event or professional fan-out was added. |
| Queue | Queue attendance expires | No queue-expiration status transition or worker was found | `queue.expired` | Queue patient, possibly assigned professional | `queue` / queue ID | `queue:{queueId}:expired:{recipientUserId}` | `not_found` | Existing overdue scheduled-consultation expiration is not queue expiration. |
| Queue | Patient leaves/cancels queue | After `cancel_queue_entry_transaction` succeeds in `supabase/functions/leave-queue/service.ts::leaveQueue` | `queue.cancelled` | Patient confirmation and/or affected assigned professional | `queue` / queue ID | `queue:{queueId}:cancelled:{recipientRole}:{recipientUserId}` | `needs_business_rule_verification` | Define recipients. If the professional receives it, resolve assigned profile ID to app-user ID. |
| Professional finance | Revenue becomes available after scheduled consultation | Candidate point after durable completion in `supabase/functions/finish-consulta/service.ts::finishConsulta` | `financial.professional_revenue_available` | Consultation professional | `consulta` / consultation ID | `professional_revenue:consulta:{consultaId}:available:{professionalUserId}` | `needs_business_rule_verification` | Current balance is derived from completed work; confirm settlement, refund, fee, and release timing before treating completion as available revenue. |
| Professional finance | Revenue becomes available after direct clinical attendance | Candidate point after `finish_solicitacao_exame_atendimento_transaction` in `finishSolicitacaoExameAtendimento` | `financial.professional_revenue_available` | Assigned professional | `clinical_request` / request ID | `professional_revenue:clinical_request:{requestId}:available:{professionalUserId}` | `needs_business_rule_verification` | Apply the same settlement rule as consultation revenue. |
| Professional finance | Professional requests withdrawal | After `repository.createSaque(...)` succeeds in `supabase/functions/request-withdrawal/service.ts::requestWithdrawal` | `financial.withdrawal_requested` | Requesting professional app user | `withdrawal` / withdrawal ID | `withdrawal:{withdrawalId}:requested:{professionalUserId}` | `already_integrated` | The notification has no data payload; PIX, amount, and bank-account data remain outside it. |
| Professional finance | Withdrawal is paid | No service or admin flow that transitions `saques` to paid was found | `financial.withdrawal_paid` | Professional | `withdrawal` / withdrawal ID | `withdrawal:{withdrawalId}:paid:{professionalUserId}` | `not_found` | Reads of paid withdrawals exist, but no write-side payment point was found. |
| Professional finance | Withdrawal is rejected | No service or admin flow that transitions `saques` to rejected was found | `financial.withdrawal_rejected` | Professional | `withdrawal` / withdrawal ID | `withdrawal:{withdrawalId}:rejected:{professionalUserId}` | `not_found` | A future administrative payout workflow should own this event. |

## Priority

Priority describes integration order, not current implementation status.

### Phase 1

1. Patient creates appointment → patient receives `appointment.created` after `createAppointment` succeeds.
2. Patient creates appointment → directly selected professional receives `appointment.received`; specialty-wide fan-out remains blocked on an audience rule.
3. Professional accepts appointment → patient receives `appointment.accepted` after the acceptance transaction; the acceptance result must expose or fetch `patient_id`.
4. Gateway confirms paid status → charge owner receives `financial.payment_approved` from the applied webhook transition, with optional local/test parity through the shared paid-transition helper.
5. Consultation finishes → patient receives `review.professional_pending` after durable completion.

### Phase 2

Implemented in this scope:

- appointment cancellation to the patient/professional counterpart when assigned;
- `financial.payment_failed`, `financial.payment_expired`, and `financial.refund_processed` from applied gateway transitions;
- `review.received` from the primary consultation-evaluation flow;
- backoffice professional approval and rejection after resolving the profile's app-user ID;
- clinical request creation and acceptance.

Clinical request completion, rejection, and document availability remain pending under their recorded schema/domain constraints.

### Phase 3A

Implemented without scheduler or broad fan-out:

- `teleconsulta.started` and `teleconsulta.finished` for the consultation patient;
- `queue.joined` and `queue.accepted` for the queue patient;
- `financial.withdrawal_requested` for the requesting professional;
- `plan.activated` for the order app user;
- `plan.credit_consumed` for appointment and queue patients only on `used_now` with a stable usage ID.

Scheduler-dependent reminders/expiry, room/record availability, queue professional fan-out/expiration/cancellation, credit reservation/coverage denial, revenue availability, and withdrawal paid/rejected remain pending under their recorded constraints.

### Phase 3B

Implemented in this scope:

- `professional.registration_submitted` after both required pending profiles are persisted;
- `plan.activation_failed` only after the paid-plan activation-failure state is persisted;
- `appointment.reminder_day` through `notifications-dispatch-scheduled`, for the patient and only the assigned professional.

The reminder dispatcher determines the day in `America/Sao_Paulo`, passes only `appointment_time` in `HH:mm`, and accepts `SOLICITADO`, `requested`, `pending`, `accepted`, `confirmed`, and `CONFIRMADO`. Immediate appointment types and all other statuses, including already-in-progress states, are excluded. `appointment.reminder_1h`, `appointment.reminder_10m`, and `appointment.starting` remain pending.

## Missing TypeKeys

The following real or requested domain events have no matching key in the seeded `notification_types` catalog:

- professional rejects an appointment;
- gateway confirms a payment chargeback;
- scheduled consultation expires or is closed as not performed;
- patient deletes/cancels a pending clinical request, if that action is intended to notify another participant.

Phase 3B adds only `plan.activation_failed`. Naming, templates, required status, and audience for the events still listed above require a separate catalog decision and migration.

## Missing Integration Points

- Only the documented Phase 1/Phase 2/Phase 3A/Phase 3B flows currently call `InternalNotificationService`; all other mapped events remain pending.
- No professional appointment-rejection flow was found.
- The day reminder dispatcher exists; one-hour, ten-minute, and starting reminder scheduling does not.
- No explicit teleconsultation room-publication or clinical-document-publication transition was found.
- No clinical-request rejection flow was found.
- No queue-expiration worker or transition was found.
- No local plan expiring, expired, or cancelled transition/callback was found.
- No withdrawal paid/rejected write-side workflow was found.
- The scheduled-consultation expiration worker returns aggregate counts rather than affected entity/recipient IDs.
- Several otherwise valid future trigger points do not currently carry the final recipient app-user ID or stable event identity in their service result, including clinical request completion and plan-credit reservation.
- Specialty appointment and queue fan-out do not have a defined final audience policy.

## Sensitive Data Rules

Notifications must use generic copy and contain only the minimum identifiers needed for safe navigation. They must not store or render:

- medical records or prontuário content;
- diagnoses;
- reports or laudos;
- exam names/results or clinical request content;
- prescriptions or receitas;
- consultation transcripts;
- complete payment or gateway payloads;
- bank account or PIX details;
- tokens, secrets, credentials, or authorization headers;
- unnecessary direct personal data.

The related destination must be authenticated and must revalidate access to the entity. A notification is not an authorization mechanism. Internal review notes and rejection reasons should remain on protected screens unless a separately approved, sanitized public reason is defined.

## Implementation Notes

Existing and future calls must run server-side and only after the authoritative state change has succeeded. Phase 1/Phase 2/Phase 3A/Phase 3B use best-effort behavior that logs notification failure without changing a confirmed business response; the Phase 3B batch also isolates failures per recipient. Future integrations must preserve that boundary and define any retry/observability policy explicitly.

Use one stable key per logical event and recipient. Because `user_notifications.deduplication_key` is globally unique and conflict recovery does not compare recipient/type/entity, every key must include the event identity and recipient.

### Appointment creation

After a new appointment is returned by `createAppointment`:

```text
recipientUserId = patient app_users.id
typeKey = appointment.created
relatedEntityType = appointment
relatedEntityId = appointment.id
deduplicationKey = appointment:{appointmentId}:created:patient:{patientUserId}
```

The Phase 1 implementation also calls the service for a directly selected professional at the same durable success boundary with `professional.appUserId`, `appointment.received`, and a recipient-specific key. Specialty fan-out remains unimplemented until its audience rule is approved.

### Appointment acceptance and cancellation

The Phase 1 implementation selects `appointments.patient_id` in the trusted acceptance-window lookup and emits only after `acceptAppointment` performs a new successful transaction. It does not notify from the already-accepted compatibility path.

Cancellation now emits after `cancel_appointment_with_plan_release` succeeds. A patient cancellation targets the assigned professional app user; a professional cancellation targets the patient. Actor confirmations, administrative cancellations, and unassigned requests do not emit.

### Payments and plan activation

The shared payment-status helper now handles applied `paid`, `payment_failed`, `payment_expired`, and `refunded` webhook transitions after owner updates. The local paid-transition helper uses the same recipient resolver and approved key only for a new paid transition. Charge creation, provider-creation failure, and chargeback remain future work.

`createPaymentCharge` should emit `financial.payment_created` only for a new provider charge after its owner is attached and provider response is saved. Payment notification recipients must be resolved through the charge owner type; the gateway payload must never be passed as notification `data`.

Plan activation now emits after `markOrderActive(...)` in `activatePlanSubscriptionForPayment`, using the same stable order/recipient key across webhook, simulation, reconciliation, and retry paths. After `markOrderActivationFailed(...)` succeeds, the same helper emits `plan.activation_failed` with a separate stable failure key. The early `already_active` return and failures before failure-state persistence do not emit.

### Consultations and reviews

`startConsultaSession` now emits `teleconsulta.started` only for a new transition to `em_atendimento`. `finishConsulta` emits both `teleconsulta.finished` and `review.professional_pending` only when the consultation changes to `finalizada`; the events remain separate because one reports completion and the other requests an evaluation.

`submitConsultaEvaluation` now emits `review.received` after the primary evaluation is durable. The legacy appointment-review endpoint remains unintegrated to avoid two sources for one logical review.

### Clinical requests

Creation and acceptance now notify after their current service-level success points with no notification `data`. Completion should notify only after `finish_solicitacao_exame_atendimento_transaction` succeeds and after the patient app-user ID is made available to the trusted caller.

Do not infer rejection from deletion, and do not infer document availability merely from a prontuário write. Those events need explicit domain transitions.

### Professional lifecycle

Registration submission emits to the newly registered `app_users.id` after both private and public pending profiles are created. Approval/rejection emits after the backoffice transactional RPC, followed by a trusted lookup of `professional_profiles.user_id`.

The legacy `reviewProfessionalApplication` path must share the same deduplication identity if it remains operational. Publication and suspension need one authoritative administrative transition before calls are added.

### Plan credit and coverage

Reservation remains pending after `create_plan_funded_appointment` or `create_plan_funded_queue` because a stable usage identity is not exposed consistently at the service boundary. Consumption now emits only on the `used_now` branch after the external plans service and local `finalize_plan_credit_usage` state both succeed.

Appointment consumption uses the acceptance-window patient; queue consumption uses the trusted queue `patient_id`. Both keys use `plan_credit_usages.id`, and neither flow emits for `already_used`.

Coverage checks are read-like and may be repeated. Do not call the service from every check until the business defines which terminal denied outcome is user-notifiable and supplies a stable attempt/entity ID.

### Queue and professional finance

Queue joined and accepted notifications now emit after their respective successful transactions and only for new transitions. The join repository marks concurrent existing-entry recovery so it cannot emit. Professional request fan-out, cancellation recipients, and expiration require rules or missing infrastructure before integration.

Withdrawal requested now emits after `createSaque` returns the persisted withdrawal, without notification data. Revenue-available notifications must wait for a settlement definition. Paid/rejected notifications belong in the future authoritative payout transition, not in list/read code.

### Scheduled events

`notifications-dispatch-scheduled` implements only the day-of appointment reminder. It is a service-role Function protected by `NOTIFICATIONS_SCHEDULER_SECRET`, determines the day in `America/Sao_Paulo`, and records per-recipient plus batch outcomes. A Supabase Cron HTTP job must invoke it daily at 04:00 local time; with a UTC cron expression this is currently `0 7 * * *`, while the Function itself never derives the business day from the runtime timezone. One-hour, ten-minute, starting, plan-expiry, and other scheduled events remain future work.

## Mapping Verification

- Existing notification type keys were compared with the migration seed.
- Domain services, repositories, payment webhooks, plan helpers, and scheduled workers were inspected.
- Phase 1/Phase 2/Phase 3A/Phase 3B `InternalNotificationService` integrations are present for the documented appointment, payment, review, professional-registration, clinical-request, teleconsultation, queue, withdrawal, plan, and day-reminder events.
- This document does not assert that repository migrations or functions are deployed to a remote environment.
- The scoped Phase 3B implementation adds one catalog key, updates the existing day-reminder template, and adds one protected scheduler. It does not add broad fan-out, external channels, preferences, or the one-hour, ten-minute, and starting reminders.
