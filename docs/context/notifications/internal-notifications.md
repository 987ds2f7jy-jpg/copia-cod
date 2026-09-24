# Internal Notifications

Status: partially implemented

Code reviewed: 2026-09-23

## Objective and scope

Provide in-application notifications to authenticated patients and professionals. The module supports a notification catalog and templates, user-specific records, unread counts, individual and bulk read actions, a notification center, and badges on the bell and user avatar.

This is a standalone system module, isolated from `src/backoffice/` and used by end users. Its canonical documentation lives in `docs/context/notifications/`; the backoffice feature index contains only a related-module reference. It must not be treated as a backoffice-only feature or share the dedicated admin identity/session.

The repository contains the schema, catalog, central service, four read/update Edge Functions, frontend, and the Phase 1/Phase 2/Phase 3A/scoped Phase 3B integrations documented below. Phase 3B adds the protected day-reminder dispatcher; preferences, external channels, other reminders, and remaining mapped integrations do not exist. Therefore the overall feature remains partially implemented.

Route: `/Notifications` (capital `N`, generated from the `Notifications` key in `src/pages.config.js`).

End users supported by the server-side access guard:

- `patient`;
- `professional`.

## Architecture

Creation architecture prepared in the repository:

```text
confirmed Phase 1/Phase 2/Phase 3A/Phase 3B business flow or protected scheduler
  → InternalNotificationService
  → notification_types lookup and template rendering
  → user_notifications snapshot
  → notification_deliveries internal delivery
  → frontend notifications module
```

Read/update architecture implemented:

```text
React notifications module
  → src/notifications/api/notifications.js
  → shared authenticated Edge Function client
  → notifications-* Supabase Edge Function
  → bearer-token, active app-user, and patient/professional validation
  → service_role query filtered by the authenticated app_users.id
  → PostgreSQL
```

The browser does not have direct table access. All three notification tables have RLS and Force RLS enabled; privileges are revoked from `PUBLIC`, `anon`, and `authenticated`, and granted to `service_role`.

## Code map

Frontend:

```text
src/notifications/
├── api/
│   └── notifications.js
├── components/
│   ├── NotificationAvatarBadge.tsx
│   ├── NotificationBell.tsx
│   └── NotificationList.tsx
├── hooks/
│   ├── useNotifications.ts
│   └── useUnreadNotificationsCount.ts
├── pages/
│   └── NotificationsPage.tsx
├── types.ts
└── utils.ts
```

Server-side shared module:

```text
supabase/functions/_shared/notifications/
├── InternalNotificationService.ts
├── NotificationAccess.ts
├── NotificationChannels.ts
├── NotificationRenderer.ts
├── NotificationTypes.ts
└── notify-best-effort.ts
```

Edge Functions found:

```text
supabase/functions/notifications-list/index.ts
supabase/functions/notifications-unread-count/index.ts
supabase/functions/notifications-mark-read/index.ts
supabase/functions/notifications-mark-all-read/index.ts
supabase/functions/notifications-dispatch-scheduled/index.ts
```

Not found:

- `notification_preferences` — Status: not found / pending future implementation;
- a `NotificationDropdown` component — Status: not found;
- a separate `NotificationTemplates` file/service — Status: not found; templates are stored in `notification_types`;
- notification APIs under `src/client-api/` — Status: not found; the feature-specific client is `src/notifications/api/notifications.js`.

## Database model

Migration: `supabase/migrations/20260912090000_create_internal_notifications.sql`.

Repository inspection confirms the migration definition and seed, not whether it has been applied to a remote environment.

### `notification_types`

Catalog and template table. One row defines a stable type key, category, title/message templates, default channels, activation, and whether the type is required.

| Column | Current definition/use |
|---|---|
| `id` | UUID primary key. |
| `key` | Unique, non-empty type key. |
| `category` | One of the nine allowed categories. |
| `title_template` | Non-empty title template. |
| `message_template` | Non-empty message template. |
| `default_channels` | JSON array, default `['internal']`. |
| `is_active` | Active flag, default `true`; inactive types are skipped by the service. |
| `is_required` | Required flag, default `false`; no runtime preference logic currently consumes it. |
| `created_at`, `updated_at` | Audit timestamps; `updated_at` is maintained by a trigger. |

### `user_notifications`

Records which application user received a notification. `title` and `message` are rendered snapshots, intentionally preserving the historical wording even if a catalog template changes later.

| Column | Current definition/use |
|---|---|
| `id` | UUID primary key. |
| `recipient_user_id` | Required FK to `app_users.id`, cascade on user deletion. |
| `notification_type_id` | Required FK to `notification_types.id`, restricted on type deletion. |
| `category` | Category snapshot constrained to the allowed values. |
| `title`, `message` | Required rendered text snapshots. |
| `data` | JSON object with sanitized primitive values, default `{}`. |
| `related_entity_type` | Optional navigation/domain discriminator. |
| `related_entity_id` | Optional UUID for the related entity. |
| `deduplication_key` | Optional globally unique idempotency key. |
| `read_at` | Null while unread; timestamp after a read action. |
| `created_at` | Creation timestamp used for descending order and cursor pagination. |
| `expires_at` | Optional expiry timestamp; current list/count queries do not filter it. |

Indexes support newest-first lists and unread queries by recipient.

### `notification_deliveries`

Represents delivery per channel and prepares the model for future dispatchers.

| Column | Current definition/use |
|---|---|
| `id` | UUID primary key. |
| `user_notification_id` | Required FK to `user_notifications.id`, cascade on deletion. |
| `channel` | `internal`, `email`, `whatsapp`, `sms`, `push`, or `gateway`. |
| `status` | `pending`, `sent`, `failed`, or `skipped`; default `pending`. |
| `attempt_count` | Non-negative attempt counter, default `0`. |
| `last_error` | Optional delivery error. |
| `sent_at` | Optional successful-delivery timestamp. |
| `created_at`, `updated_at` | Audit timestamps; `updated_at` is trigger-maintained. |

`(user_notification_id, channel)` is unique. Although the schema and types name future channels, `resolveNotificationChannels` currently always resolves to `['internal']`. The internal delivery is immediately stored as `sent` with `sent_at`; no external delivery is created or dispatched.

## Seeded categories and notification types

The migration seeds the following exact catalog using `ON CONFLICT (key) DO NOTHING`.

### `appointment`

- `appointment.created`
- `appointment.received`
- `appointment.accepted`
- `appointment.cancelled`
- `appointment.reminder_day`
- `appointment.reminder_1h`
- `appointment.reminder_10m`
- `appointment.starting`

### `financial`

- `financial.payment_created`
- `financial.payment_approved`
- `financial.payment_failed`
- `financial.payment_expired`
- `financial.refund_processed`
- `financial.professional_revenue_available`
- `financial.withdrawal_requested`
- `financial.withdrawal_paid`
- `financial.withdrawal_rejected`

### `review`

- `review.professional_pending`
- `review.received`

### `clinical_request`

- `clinical_request.created`
- `clinical_request.accepted`
- `clinical_request.rejected`
- `clinical_request.completed`
- `clinical_request.document_available`

### `professional`

- `professional.registration_submitted`
- `professional.registration_approved`
- `professional.registration_rejected`
- `professional.profile_published`
- `professional.profile_suspended`

### `plan`

- `plan.activated`
- `plan.activation_failed` (added by `20260923090000_add_phase3b_notification_types.sql`)
- `plan.expiring`
- `plan.expired`
- `plan.cancelled`
- `plan.credit_reserved`
- `plan.credit_consumed`
- `plan.coverage_denied`

### `queue`

- `queue.joined`
- `queue.request_received`
- `queue.accepted`
- `queue.expired`
- `queue.cancelled`

### `teleconsulta`

- `teleconsulta.room_available`
- `teleconsulta.started`
- `teleconsulta.finished`
- `teleconsulta.record_available`

### `system`

- `system.general`

## Central creation service

File: `supabase/functions/_shared/notifications/InternalNotificationService.ts`.

Entry point:

```ts
notify({
  recipientUserId,
  typeKey,
  data?,
  relatedEntityType?,
  relatedEntityId?,
  deduplicationKey?,
  channels?,
  expiresAt?,
})
```

Behavior:

1. Validates `recipientUserId` as UUID, rejects an empty `typeKey`, and validates a supplied `relatedEntityId` as UUID.
2. Looks up `notification_types` by the trimmed `typeKey`.
3. Returns `404 NOTIFICATION_TYPE_NOT_FOUND` for an unknown type and a generic `500 NOTIFICATION_TYPE_LOOKUP_FAILED` for lookup failure.
4. For `is_active = false`, creates nothing and returns `{ notification: null, deduplicated: false, skipped: true }`.
5. Sanitizes `data`, renders title and message, and inserts their snapshots in `user_notifications`.
6. Resolves the effective channels; current behavior always chooses only `internal`.
7. Upserts the internal delivery, marking it `sent` immediately.
8. Returns the created notification with `deduplicated: false` and `skipped: false`.

The service accepts only a non-array object for `data`. Keys must start with a letter and contain at most 64 alphanumeric/underscore characters. Keys matching clinical or direct personal-data terms such as prontuário, laudo, exame, diagnóstico, medical, result, transcrição, prescrição, CPF, email, phone, or telefone are dropped. Values must be string, number, or boolean; strings have line breaks/tabs normalized, are trimmed, and are capped at 160 characters.

The service uses the supplied Supabase client; callers are expected to instantiate it only in a trusted server-side flow with the necessary privileges. No public creation Edge Function exists.

### Idempotency and `deduplication_key`

`deduplication_key` protects webhooks, retries, scheduled jobs, and repeated events from creating the same logical notification more than once. Suitable domain-generated examples are:

```text
appointment:{appointmentId}:created:patient:{patientUserId}
appointment:{appointmentId}:accepted:patient:{patientUserId}
payment_charge:{paymentChargeId}:approved:{patientUserId}
withdrawal:{withdrawalId}:paid:{professionalUserId}
review:{consultaId}:pending:{patientUserId}
```

Current conflict behavior is confirmed in code:

- the database uniqueness constraint is global across `user_notifications`;
- on PostgreSQL error `23505` with a non-null key, the service fetches the existing row by that key;
- it ensures the existing row has its internal delivery and returns it with `deduplicated: true`;
- it does not create another user notification;
- without a deduplication key, callers receive `500 NOTIFICATION_CREATE_FAILED` for an insert failure and repeated calls are not deduplicated.

Callers must include recipient and event identity in the key. The conflict recovery does not revalidate that the existing row has the same recipient, type, or related entity as the new input.

## Template rendering

File: `supabase/functions/_shared/notifications/NotificationRenderer.ts`.

Placeholders use `{{name}}` with letters, digits, and underscores. Example:

```text
Template: Seu agendamento com {{professional_name}} foi aceito.
Data:     { "professional_name": "Dra. Maria" }
Result:   Seu agendamento com Dra. Maria foi aceito.
```

Confirmed behavior:

- a missing, `null`, or `undefined` value becomes an empty string;
- strings, numbers, and booleans become text;
- object and array values become an empty string;
- replacement strings have line breaks/tabs collapsed, are trimmed, and are capped at 500 characters (the service's sanitized strings are already capped at 160);
- the renderer returns a string and does not execute markup;
- the renderer does not HTML-escape or strip tags itself. The current React list renders `title` and `message` as text nodes and does not use `dangerouslySetInnerHTML`, so strings such as `<script>...</script>` are displayed as text rather than executed. Any future HTML renderer must escape content explicitly.

Unit coverage exists in `tests/unit/notifications/NotificationRenderer.test.ts` for a normal placeholder, missing/null values, numeric values, and markup remaining inert plain text.

## Edge Functions and contracts

All four Functions:

- handle `OPTIONS` before method validation, body parsing, authentication, or database access;
- use the shared response envelope `{ data, meta: { requestId } }` or `{ error: { code, message, details, requestId } }`;
- require `Authorization: Bearer <Supabase access token>` in application code;
- resolve the token to an active `app_users` row and allow only `patient` or `professional`;
- use a server-side `service_role` client only after authentication;
- return safe application errors through the shared handler.

The current shared preflight helper returns `200` with body `ok` and CORS headers for an allowed origin. A disallowed configured origin returns `403`. It runs before all other processing.

Common authentication/authorization failures include `401 AUTH_REQUIRED`, `401 AUTH_TOKEN_INVALID`, `401 AUTH_USER_INVALID`, `403 APP_USER_NOT_FOUND`, `403 ACCOUNT_INACTIVE`, and `403 NOTIFICATIONS_ROLE_FORBIDDEN`.

### `notifications-list`

- Methods: `GET`, `POST`.
- GET input: query parameters `limit`, `cursor`, and `unread`.
- POST input: `{ "limit": 20, "cursor": null, "unread": false }`.
- `limit`: defaults to 20, is truncated to an integer, and is clamped from 1 through 50.
- `cursor`: when non-empty, applies `created_at < cursor`.
- `unread`: `true` or string `"true"` filters `read_at is null`.
- Tables: `user_notifications`, joined to `notification_types` for `typeKey`.
- Ownership: always filters `recipient_user_id = authenticated app_users.id`.
- Order: newest `created_at` first.
- Success data:

```json
{
  "items": [
    {
      "id": "uuid",
      "category": "appointment",
      "typeKey": "appointment.accepted",
      "title": "Agendamento aceito",
      "message": "Seu agendamento com Dra. Maria foi aceito.",
      "data": {},
      "relatedEntityType": "appointment",
      "relatedEntityId": "uuid",
      "readAt": null,
      "createdAt": "timestamp"
    }
  ],
  "nextCursor": "timestamp-or-null"
}
```

Main errors: `400 INVALID_JSON` for malformed POST JSON, method `405`, authentication/role failures, and `500 NOTIFICATIONS_LIST_FAILED`.

### `notifications-unread-count`

- Methods: `GET`, `POST`.
- Payload: none required; the frontend sends `{}` by POST.
- Table: `user_notifications`.
- Ownership: filters the authenticated `recipient_user_id` and `read_at is null`.
- Success data: `{ "unreadCount": 0 }`.
- Main errors: method `405`, authentication/role failures, and `500 NOTIFICATIONS_UNREAD_COUNT_FAILED`.

### `notifications-mark-read`

- Method: `POST`.
- Payload: `{ "notificationId": "uuid" }`.
- Table: `user_notifications`.
- Ownership: both lookup and update require `id = notificationId` and `recipient_user_id = authenticated app_users.id`.
- Behavior: an owned notification already read returns success; otherwise it sets `read_at` once.
- Success data: `{ "success": true }`.
- Cross-user/not-found behavior: `404 NOTIFICATION_NOT_FOUND`; it does not reveal whether another user owns the ID.
- Other main errors: `400 INVALID_JSON`, `422 NOTIFICATION_ID_INVALID`, method `405`, authentication/role failures, and `500 NOTIFICATION_MARK_READ_FAILED`.

### `notifications-mark-all-read`

- Method: `POST`.
- Payload: none required; the frontend sends `{}`.
- Table: `user_notifications`.
- Ownership: updates only rows for the authenticated `recipient_user_id` where `read_at is null`.
- Success data: `{ "success": true, "updatedCount": 0 }`.
- Main errors: method `405`, authentication/role failures, and `500 NOTIFICATIONS_MARK_ALL_READ_FAILED`.

### `notifications-dispatch-scheduled`

Status: implemented for `appointment.reminder_day`.

- Method: `POST`.
- Authentication: `x-notifications-scheduler-secret` matched against `NOTIFICATIONS_SCHEDULER_SECRET`; no end-user session.
- Runtime: service-role client.
- Optional manual payload: `{ "date": "YYYY-MM-DD" }`; omission uses the current `America/Sao_Paulo` date.
- Success data: batch date/timezone and scanned, eligible, processed, created, deduplicated, skipped, and failed counts.
- Isolation: a notification or professional-recipient lookup failure is logged and does not stop later recipients.

## Frontend behavior

`src/notifications/api/notifications.js` calls all four Functions through `src/client-api/edgeFunctions.js`, whose default mode requires the normal stored user session, sends the bearer token, attempts a session refresh on `401`, and unwraps the shared `data` envelope.

`NotificationsPage.tsx`:

- is wrapped in the normal `ProtectedRoute`;
- loads the default first page of notifications;
- shows loading, error, empty, and populated states;
- allows each unread row to be marked read;
- enables “Marcar todas como lidas” when the loaded page contains an unread item.

`useNotifications` caches the list for 15 seconds. Successful individual or bulk read mutations invalidate both the list and unread-count query keys. The page does not expose the backend's cursor, unread-only filter, or a load-more control.

`useUnreadNotificationsCount` caches for 15 seconds and polls every 60 seconds while enabled. `Layout.jsx` enables notifications only for patient/professional roles and uses the count in two places:

- `NotificationBell` in the authenticated header links to `/Notifications` and shows a red count capped visually at `9+`;
- `NotificationAvatarBadge` wraps the user icon in the profile dropdown trigger and shows the same capped badge.

The current UI has no notification dropdown.

Click/navigation behavior in `NotificationList`:

| `relatedEntityType` | Destination |
|---|---|
| `appointment` | No destination yet; remains in the notification center because role-specific dashboards differ. |
| `consulta` with ID | `/consulta/:id` |
| `payment_charge` | `/MeusPagamentos` |
| `plan` | `/MeusPlanos` |
| `clinical_request` | `/SolicitacaoExames` |
| Any other value | No destination. |

Those destinations are protected by the normal application route/page guards. Clicking content navigates when a destination exists but does not automatically mark the notification read; the explicit “Marcar como lida” button performs that mutation.

## Mandatory security and privacy rules

- A user may list and count only their own notifications.
- A user may mark only their own notification(s) as read.
- The frontend must never create notifications directly; creation must occur in a trusted confirmed business flow through `InternalNotificationService`.
- Do not store clinical details, medical records, diagnoses, exam/report/result content, prescriptions, or transcripts in `title`, `message`, or `data`.
- Do not store tokens, secrets, passwords, full payment payloads, CPF, email, phone, or other unnecessary personal data.
- Keep notification copy minimal; sensitive details belong on the protected destination screen.
- A notification link must resolve only to an authenticated/protected screen that revalidates access to the underlying entity.
- Keep ownership filters server-side even though the UI hides controls by role.
- `verify_jwt = false` at the Supabase gateway does not make these Functions public; the application-level bearer-token and active-account guard is mandatory.

## Integrated flows

Phase 1, Phase 2, Phase 3A, and Phase 3B calls use `InternalNotificationService`. Business-flow calls run only after the authoritative write succeeds and are best-effort. The scheduled batch isolates each recipient failure. Failures are logged with type, recipient, entity, deduplication key, request/execution ID, raw error, and available message/code/details/hint fields, without rolling back or masking a confirmed domain operation.

### Appointments

| Event | typeKey | Recipient | Trigger | Related entity | Deduplication key | Status |
|---|---|---|---|---|---|---|
| Appointment created | `appointment.created` | Patient `app_users.id` | `supabase/functions/create-appointment/service.ts::createAppointment`, after repository creation | `appointment` | `appointment:{appointmentId}:created:patient:{patientUserId}` | implemented |
| Direct professional receives appointment | `appointment.received` | Selected professional `professional_profiles.user_id` | Same successful creation point, only when a profile was selected directly | `appointment` | `appointment:{appointmentId}:received:professional:{professionalUserId}` | implemented |
| Appointment accepted | `appointment.accepted` | `appointments.patient_id` | `supabase/functions/accept-appointment/service.ts::acceptAppointment`, only after a new acceptance transaction | `appointment` | `appointment:{appointmentId}:accepted:patient:{patientUserId}` | implemented |
| Patient cancels assigned appointment | `appointment.cancelled` | Assigned professional resolved from `professional_profiles.user_id` | `supabase/functions/cancel-appointment/service.ts::cancelAppointment`, after the cancellation transaction | `appointment` | `appointment:{appointmentId}:cancelled:professional:{professionalUserId}` | implemented |
| Professional cancels appointment | `appointment.cancelled` | `appointments.patient_id` | Same successful cancellation point | `appointment` | `appointment:{appointmentId}:cancelled:patient:{patientUserId}` | implemented |
| Daily appointment reminder | `appointment.reminder_day` | Patient and assigned professional app user, when present | Daily `notifications-dispatch-scheduled` batch | `appointment` | `appointment:{appointmentId}:reminder_day:{recipientRole}:{recipientUserId}` | implemented |

The repeated/already-cancelled path does not emit. Administrative cancellations, patient cancellations without an assigned professional, actor confirmations, and open-specialty fan-out do not emit. One-hour, ten-minute, and starting reminders remain unimplemented.

### Payments, finance, and withdrawals

| Event | typeKey | Recipient | Trigger | Related entity | Deduplication key | Status |
|---|---|---|---|---|---|---|
| Payment approved | `financial.payment_approved` | Owner patient/app user, resolved from `appointment`, `queue`, `solicitacao_exame`, or `plan_subscription` | `supabase/functions/payments-webhook/handler.ts::applyProviderStatus`, after an applied `paid` transition and owner update | `payment_charge` | `payment_charge:{paymentChargeId}:approved:{recipientUserId}` | implemented |
| Simulated/reconciled payment approved | `financial.payment_approved` | Same owner resolution | `supabase/functions/_shared/payments/mark-payment-as-paid.ts::markPaymentAsPaid`, only for a new transition to paid | `payment_charge` | Same key as the webhook | implemented |
| Payment failed | `financial.payment_failed` | Same owner resolution | `payments-webhook/handler.ts::applyProviderStatus`, after an applied `payment_failed` transition and owner update | `payment_charge` | `payment_charge:{paymentChargeId}:failed:{recipientUserId}` | implemented |
| Payment expired | `financial.payment_expired` | Same owner resolution | Same point for an applied `payment_expired` transition | `payment_charge` | `payment_charge:{paymentChargeId}:expired:{recipientUserId}` | implemented |
| Refund processed | `financial.refund_processed` | Same owner resolution | Same point for an applied `refunded` transition | `payment_charge` | `payment_charge:{paymentChargeId}:refunded:{recipientUserId}` | implemented |
| Withdrawal requested | `financial.withdrawal_requested` | Requesting professional `app_users.id` | `supabase/functions/request-withdrawal/service.ts::requestWithdrawal`, after `createSaque` succeeds | `withdrawal` | `withdrawal:{withdrawalId}:requested:{professionalUserId}` | implemented |

The shared status helper resolves payment owners consistently. Gateway payloads, failure reasons, refund payloads, withdrawal amounts, PIX keys, and banking data are not copied into notification data. Chargeback, charge-creation, revenue, and withdrawal paid/rejected events remain pending.

### Reviews

| Event | typeKey | Recipient | Trigger | Related entity | Deduplication key | Status |
|---|---|---|---|---|---|---|
| Professional evaluation pending | `review.professional_pending` | `consultas.paciente_id` | `supabase/functions/finish-consulta/service.ts::finishConsulta`, after a real transition to `finalizada` and related updates | `consulta` | `review:{consultaId}:pending:patient:{patientUserId}` | implemented |
| Consultation evaluation received | `review.received` | `consultas.profissional_user_id` | `supabase/functions/submit-consulta-evaluation/service.ts::submitConsultaEvaluation`, immediately after evaluation creation | `consulta` | `review:{consultaId}:received:professional:{professionalUserId}` | implemented |

The legacy `submit-appointment-review` flow does not emit; the consultation evaluation is the canonical integrated source for this phase.

### Clinical requests

| Event | typeKey | Recipient | Trigger | Related entity | Deduplication key | Status |
|---|---|---|---|---|---|---|
| Clinical request created | `clinical_request.created` | Creating patient `app_users.id` | `supabase/functions/create-solicitacao-exame/service.ts::createSolicitacaoExame`, after persistence/payment-charge setup succeeds | `clinical_request` | `clinical_request:{requestId}:created:patient:{patientUserId}` | implemented |
| Clinical request accepted | `clinical_request.accepted` | `solicitacoes_exames.paciente_id` | `supabase/functions/accept-solicitacao-exame/service.ts::acceptSolicitacaoExame`, after a new conditional acceptance update | `clinical_request` | `clinical_request:{requestId}:accepted:patient:{patientUserId}` | implemented |

Rejected, completed, and document-available events remain pending. No clinical details are included in notification data.

### Professional registration/approval

| Event | typeKey | Recipient | Trigger | Related entity | Deduplication key | Status |
|---|---|---|---|---|---|---|
| Registration submitted | `professional.registration_submitted` | Newly registered `app_users.id` | `supabase/functions/register-professional/service.ts::registerProfessional`, after both required pending profiles | `professional_profile` | `professional_profile:{profileId}:submitted:{professionalUserId}` | implemented |
| Registration approved | `professional.registration_approved` | `professional_profiles.user_id` | `supabase/functions/backoffice-review-professional/service.ts::reviewBackofficeProfessional`, after the transactional RPC | `professional_profile` | `professional_profile:{profileId}:approved:{professionalUserId}` | implemented |
| Registration rejected | `professional.registration_rejected` | `professional_profiles.user_id` | Same successful transactional review point | `professional_profile` | `professional_profile:{profileId}:rejected:{professionalUserId}` | implemented |

The pending-only RPC prevents emission for already-reviewed profiles. Internal reason/notes are never passed to notification creation. The legacy normal-app admin review remains unintegrated.

### Plans

| Event | typeKey | Recipient | Trigger | Related entity | Deduplication key | Status |
|---|---|---|---|---|---|---|
| Plan activated | `plan.activated` | Order `app_user_id`, with the existing `patient_id` fallback resolved to `app_users.id` | `supabase/functions/_shared/plans/activate-plan-subscription.ts::activatePlanSubscriptionForPayment`, after `markOrderActive` | `plan` | `plan_order:{orderId}:activated:{recipientUserId}` | implemented |
| Plan activation failed | `plan.activation_failed` | Order `app_user_id`, with the existing `patient_id` fallback | Same helper, only after `markOrderActivationFailed` succeeds | `plan` | `plan_order:{orderId}:activation_failed:{recipientUserId}` | implemented |
| Appointment credit consumed | `plan.credit_consumed` | Appointment patient `app_users.id` | `supabase/functions/accept-appointment/service.ts::acceptAppointment`, after credit confirmation returns `used_now` | `appointment` | `plan_credit:{usageId}:consumed:patient:{patientUserId}` | implemented |
| Queue credit consumed | `plan.credit_consumed` | Queue patient `app_users.id` | `supabase/functions/accept-queue-entry/service.ts::acceptQueueEntry`, after credit confirmation returns `used_now` | `queue` | `plan_credit:{usageId}:consumed:patient:{patientUserId}` | implemented |

Already-active plan repair/retry paths and `already_used` credit confirmations do not emit. Repeated representations of the same activation failure reuse one key. Expiry, cancellation, credit reservation, and coverage-denied events remain pending.

### Queue/immediate consultation

| Event | typeKey | Recipient | Trigger | Related entity | Deduplication key | Status |
|---|---|---|---|---|---|---|
| Patient joins queue | `queue.joined` | Patient `app_users.id` | `supabase/functions/join-queue/service.ts::joinQueue`, after a newly created queue entry | `queue` | `queue:{queueId}:joined:patient:{patientUserId}` | implemented |
| Professional accepts queue entry | `queue.accepted` | Transaction result `queue_patient_id` | `supabase/functions/accept-queue-entry/service.ts::acceptQueueEntry`, after the acceptance transaction | `queue` | `queue:{queueId}:accepted:patient:{patientUserId}` | implemented |

An existing active entry, including the concurrent uniqueness-recovery path, does not emit `queue.joined`. Professional fan-out, room availability, expiration, and cancellation remain pending.

### Teleconsultation

| Event | typeKey | Recipient | Trigger | Related entity | Deduplication key | Status |
|---|---|---|---|---|---|---|
| Consultation started | `teleconsulta.started` | `consultas.paciente_id` | `supabase/functions/start-consulta-session/service.ts::startConsultaSession`, after a new atomic transition to `em_atendimento` | `consulta` | `consulta:{consultaId}:started:patient:{patientUserId}` | implemented |
| Consultation finished | `teleconsulta.finished` | `consultas.paciente_id` | `supabase/functions/finish-consulta/service.ts::finishConsulta`, after a new transition to `finalizada` and linked updates | `consulta` | `consulta:{consultaId}:finished:patient:{patientUserId}` | implemented |

Idempotent room-state repair and already-finalized paths do not emit. `teleconsulta.finished` and `review.professional_pending` remain separate notifications because completion and the evaluation prompt are distinct events. Room and record availability remain pending.

Result: the infrastructure, user-facing reader, five Phase 1 types, nine Phase 2 types, seven Phase 3A types, and three Phase 3B types are integrated. All remaining events stay pending as described in `notification-events-map.md`.

## Supabase configuration

`supabase/config.toml` contains:

```toml
[functions.notifications-list]
verify_jwt = false

[functions.notifications-unread-count]
verify_jwt = false

[functions.notifications-dispatch-scheduled]
verify_jwt = false

[functions.notifications-mark-read]
verify_jwt = false

[functions.notifications-mark-all-read]
verify_jwt = false
```

The four end-user Functions authenticate through `requireNotificationEndUser`; `OPTIONS` is handled first. The scheduled Function does not use an end-user session: it requires `x-notifications-scheduler-secret` to match the `NOTIFICATIONS_SCHEDULER_SECRET` Edge Function secret and then uses the service-role client.

## Daily appointment reminder scheduler

`notifications-dispatch-scheduled` implements only `appointment.reminder_day`. On each run it determines the target date in `America/Sao_Paulo` (or accepts a validated `YYYY-MM-DD` date for manual testing), loads appointments for that day, and processes failures independently.

Eligible statuses, copied from active appointment flows in the repository, are:

- `SOLICITADO`;
- `requested`;
- `pending`;
- `accepted`;
- `confirmed`;
- `CONFIRMADO`.

All other statuses are excluded, including in-progress, cancelled, completed/finalized, expired, and not-performed values. Appointment types `instant`, `plantao`, and `imediato` are also excluded. The patient always receives an eligible reminder; the professional receives one only when `appointments.professional_id` resolves to `professional_profiles.user_id`. There is no specialty, availability, online, or candidate fan-out.

The Function passes only `{ "appointment_time": "HH:mm" }`. Explicit appointment time is preferred; an offset-bearing `scheduled_datetime` is converted server-side with `America/Sao_Paulo`. The catalog template is `Você tem uma consulta hoje às {{appointment_time}}.`

The remote Supabase Cron job must be configured per environment to send an HTTP `POST` daily at 04:00 `America/Sao_Paulo`. For a UTC-only cron configuration, the applicable expression is currently `0 7 * * *`. The Function still computes the local business date explicitly and does not trust the runtime timezone. The request must include:

```text
x-notifications-scheduler-secret: <same value as NOTIFICATIONS_SCHEDULER_SECRET>
```

Manual invocation for a controlled date:

```bash
curl --request POST \
  "$SUPABASE_URL/functions/v1/notifications-dispatch-scheduled" \
  --header "Content-Type: application/json" \
  --header "x-notifications-scheduler-secret: $NOTIFICATIONS_SCHEDULER_SECRET" \
  --data '{"date":"2026-09-23"}'
```

Omit `date` for the current São Paulo day. Re-execution is safe because each patient/professional key is stable. Logs contain only entity/recipient identifiers, role, type, key, outcome, and execution ID; the response includes aggregate created/deduplicated/skipped/failed counts.

## Touchpoints outside the isolated notification folders

Confirmed current integration/context points:

- `src/pages.config.js` — lazy-loads the page and registers the `Notifications` route key.
- `src/App.tsx` — generic page-map routing turns that key into `/Notifications`; it also defines protected entity destinations such as `/consulta/:consultaId`.
- `src/Layout.jsx` — places the bell and avatar badge in the normal authenticated layout.
- `src/client-api/edgeFunctions.js` — shared authenticated Function transport used by the feature-specific client.
- `src/components/ProtectedRoute.jsx` — normal user-session guard used by the notification page/destinations.
- `src/pages/SolicitacaoExames.jsx`, `src/pages/MeusPagamentos.jsx`, and `src/pages/MeusPlanos.jsx` — protected destination screens selected by `notificationDestination`.
- `supabase/functions/_shared/auth.ts`, `sessionAccount.ts`, `http.ts`, and `supabase.ts` — shared authentication, active-account, HTTP/CORS, and privileged-client helpers.
- `supabase/functions/_shared/payments/payment-status-notification.ts` — resolves the payment owner to an app user and emits approved/failed/expired/refunded events without exposing provider payloads.
- `supabase/migrations/20260912090000_create_internal_notifications.sql` — schema, constraints, grants, indexes, and original catalog seed.
- `supabase/migrations/20260923090000_add_phase3b_notification_types.sql` — idempotent `plan.activation_failed` insert and day-reminder template update.
- `supabase/config.toml` — gateway configuration for the end-user Functions and protected scheduled dispatcher.
- `tests/unit/notifications/NotificationRenderer.test.ts` — renderer unit coverage.
- `docs/NOTIFICATIONS_CONTEXT.md` — earlier concise module context.

Integrated touchpoints include appointment creation/acceptance/cancellation/day reminder, payment webhook/local paid transition, consultation start/finish/evaluation, queue join/acceptance, professional registration/backoffice review, withdrawal request, plan activation/failure/credit consumption, and clinical-request creation/acceptance. Other mapped events remain pending.

## Manual validation checklist

Administrative inspection queries:

```sql
select key, category, title_template, message_template, is_active
from public.notification_types
order by category, key;
```

```sql
select id, recipient_user_id, category, title, message, read_at, created_at
from public.user_notifications
order by created_at desc
limit 50;
```

```sql
select d.*
from public.notification_deliveries d
join public.user_notifications n on n.id = d.user_notification_id
order by d.created_at desc
limit 50;
```

- [ ] Confirm the migration and seeded catalog exist in the target environment.
- [ ] Create each Phase 1/Phase 2/Phase 3A/Phase 3B domain event through its trusted backend flow or protected scheduler; never insert from the browser.
- [ ] Confirm one `user_notifications` snapshot and one `internal/sent` delivery.
- [ ] Open `/Notifications` as the recipient and confirm list rendering.
- [ ] Confirm the bell and avatar badges show the unread count and refresh within the polling interval.
- [ ] Mark one notification read and confirm `read_at`, the row style, and count update.
- [ ] Mark all read and confirm only the authenticated recipient's unread rows change.
- [ ] Call the read endpoint with another user's token/notification ID and expect `404` without cross-user mutation.
- [ ] Call all Functions without a token and with an invalid token; expect authentication failure.
- [ ] Test `OPTIONS` before auth/body/method and confirm the current `200` response plus CORS headers for an allowed origin.
- [ ] Repeat the same creation with a stable `deduplication_key`; confirm one user notification and `deduplicated: true` on the retry.
- [ ] Deactivate a test notification type and confirm the service returns `skipped: true` without inserts.
- [ ] Confirm sensitive keys and non-primitive `data` values are removed.
- [ ] Confirm notification destinations require authentication and enforce entity-level access.

Relevant automated command:

```bash
npm test -- src/test/internal-notifications-phase1.test.ts src/test/internal-notifications-phase2.test.ts src/test/internal-notifications-phase3a.test.ts src/test/internal-notifications-phase3b.test.ts tests/unit/notifications/NotificationRenderer.test.ts
```

## Implementation verification

- `git diff --check`: passed for the Phase 3B implementation.
- Targeted Phase 3B Vitest command and full `npm test`: attempted, but local dependencies are unavailable (`vitest` is not recognized as a command).
- `npm run build`: attempted, but local dependencies are unavailable (`vite` is not recognized as a command).
- `npm run lint`: attempted, but local dependencies are unavailable (`eslint` is not recognized as a command).
- `npm run typecheck`: unavailable because the project has no `typecheck` script.
- `npm run check:supabase-functions-config`: passed for all 80 configured Functions.
- Database, browser, and deployed Edge Function checks: not run; no remote environment was accessed.

## Risks and pending verification

- Remote migration, seed, Function deployment, secrets, gateway configuration, and live data cannot be confirmed from repository contents.
- Only the documented Phase 1/Phase 2/Phase 3A/Phase 3B events create notifications; all other mapped events remain pending.
- Repository state cannot confirm that the remote 04:00 Supabase Cron job or its shared secret has been applied.
- `notification_preferences` and a preferences UI are absent.
- Only the internal channel is operational; email, WhatsApp, SMS, push, and gateway are schema/type placeholders.
- `expires_at` exists but current list and unread-count queries do not exclude expired rows.
- The page loads only the first 20 rows; cursor pagination exists server-side but has no UI.
- The template renderer returns plain strings but does not strip/escape HTML itself; safety currently depends on text-node rendering and must be preserved by future consumers.
- Notification insertion and delivery insertion are separate database requests, not one transaction. A delivery failure can leave a notification without a delivery; a retry with the same deduplication key can repair the internal delivery.
- Deduplication recovery looks up only the globally unique key and does not compare the existing recipient/type/entity with the new input; key construction must therefore include stable recipient and event identity.
- Phase 1/Phase 2/Phase 3A/Phase 3B regression tests cover catalog keys, post-persistence placement, idempotent guards, owner-aware keys, recipient selection, timezone formatting, batch resilience, privacy boundaries, and best-effort behavior. Dedicated database-backed tests for notification creation, ownership, Function contracts, frontend hooks/components, polling, pagination, and destination access remain pending.
- Manual browser, database, and deployed Function validation was not performed in this task.

## Future improvements

Subject to separate feature work and design/security review:

- integrate the remaining appointment, payment, clinical-request, professional, plan, queue, withdrawal, and teleconsultation events;
- add the remaining one-hour, ten-minute, and starting reminder schedules only under separately approved scope;
- add notification preferences while respecting required notification types;
- add cursor/load-more or infinite scrolling and an unread filter;
- define expiry behavior;
- add Realtime or refine polling;
- implement external dispatchers for email, WhatsApp, SMS, push, or a gateway with retries and observability;
- add a preference screen and, if needed, backoffice catalog/operations tooling;
- add service, API ownership, and frontend automated coverage.
