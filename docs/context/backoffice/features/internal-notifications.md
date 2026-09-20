# Internal Notifications

Status: partially implemented

Code reviewed: 2026-09-20

## Objective and scope

Provide in-application notifications to authenticated patients and professionals. The module supports a notification catalog and templates, user-specific records, unread counts, individual and bulk read actions, a notification center, and badges on the bell and user avatar.

This is a standalone system module, isolated from `src/backoffice/` and used by end users. It is documented under the backoffice context only because `docs/context/backoffice/FEATURES.md` is the project's quick index for administrative and cross-cutting features. It must not be treated as a backoffice-only feature or share the dedicated admin identity/session.

The repository contains the schema, seeded catalog, central service, four read/update Edge Functions, and frontend. It does not contain calls from domain flows to the central service or a scheduled dispatcher. Therefore the end-to-end business feature is only partially implemented.

Route: `/Notifications` (capital `N`, generated from the `Notifications` key in `src/pages.config.js`).

End users supported by the server-side access guard:

- `patient`;
- `professional`.

## Architecture

Creation architecture prepared in the repository:

```text
confirmed business flow (not integrated yet)
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
└── NotificationTypes.ts
```

Edge Functions found:

```text
supabase/functions/notifications-list/index.ts
supabase/functions/notifications-unread-count/index.ts
supabase/functions/notifications-mark-read/index.ts
supabase/functions/notifications-mark-all-read/index.ts
```

Not found:

- `supabase/functions/notifications-dispatch-scheduled` — Status: not found / pending future implementation;
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

Status: not found / pending future implementation.

No scheduled reminder Function, cron definition, or matching `supabase/config.toml` entry was found. Seeded reminder types do not by themselves schedule or create notifications.

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

Repository-wide searches found no import/instantiation of `InternalNotificationService` and no `.notify(...)` call in any domain Edge Function. The migration seeds types, but seeds do not create user notifications.

### Appointments

Status: not found / pending integration.

Seeded types include created, received, accepted, cancelled, reminders, and starting, but appointment flows do not call the notification service.

### Payments, finance, and withdrawals

Status: not found / pending integration.

Seeded types cover payment lifecycle, refund, professional revenue, and withdrawal lifecycle, but no corresponding service call was found.

### Reviews

Status: not found / pending integration.

The catalog contains `review.professional_pending` and `review.received`; no review flow calls the service.

### Clinical requests

Status: not found / pending integration.

The catalog contains created, accepted, rejected, completed, and document-available types; no clinical-request flow calls the service.

### Professional registration/approval

Status: not found / pending integration.

The catalog includes submitted, approved, rejected, published, and suspended types. Neither normal registration nor backoffice review currently calls the service.

### Plans

Status: not found / pending integration.

The catalog covers activation, expiry, cancellation, reservation/consumption, and denied coverage; no plan flow calls the service.

### Queue/immediate consultation

Status: not found / pending integration.

The catalog covers joined, request received, accepted, expired, and cancelled; no queue flow calls the service.

### Teleconsultation

Status: not found / pending integration.

The catalog covers room available, started, finished, and record available; no teleconsultation flow calls the service.

Result: the infrastructure and user-facing reader exist, but no real application event currently produces a notification through this module.

## Supabase configuration

`supabase/config.toml` contains:

```toml
[functions.notifications-list]
verify_jwt = false

[functions.notifications-unread-count]
verify_jwt = false

[functions.notifications-mark-read]
verify_jwt = false

[functions.notifications-mark-all-read]
verify_jwt = false
```

This project performs application authentication inside each Function through `requireNotificationEndUser`. `OPTIONS` is handled first so preflight does not require a token. `notifications-dispatch-scheduled` has no entry because the Function does not exist.

## Touchpoints outside the isolated notification folders

Confirmed current integration/context points:

- `src/pages.config.js` — lazy-loads the page and registers the `Notifications` route key.
- `src/App.tsx` — generic page-map routing turns that key into `/Notifications`; it also defines protected entity destinations such as `/consulta/:consultaId`.
- `src/Layout.jsx` — places the bell and avatar badge in the normal authenticated layout.
- `src/client-api/edgeFunctions.js` — shared authenticated Function transport used by the feature-specific client.
- `src/components/ProtectedRoute.jsx` — normal user-session guard used by the notification page/destinations.
- `src/pages/SolicitacaoExames.jsx`, `src/pages/MeusPagamentos.jsx`, and `src/pages/MeusPlanos.jsx` — protected destination screens selected by `notificationDestination`.
- `supabase/functions/_shared/auth.ts`, `sessionAccount.ts`, `http.ts`, and `supabase.ts` — shared authentication, active-account, HTTP/CORS, and privileged-client helpers.
- `supabase/migrations/20260912090000_create_internal_notifications.sql` — schema, constraints, grants, indexes, and catalog seed.
- `supabase/config.toml` — gateway configuration for the four Functions.
- `tests/unit/notifications/NotificationRenderer.test.ts` — renderer unit coverage.
- `docs/NOTIFICATIONS_CONTEXT.md` — earlier concise module context.

No appointment, payment, consultation, clinical-request, professional-approval, queue, plan, withdrawal, or other business-flow file currently integrates the creation service.

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
- [ ] Create a test notification through a temporary trusted server-side harness that invokes `InternalNotificationService`; never insert from the browser.
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
npm test -- tests/unit/notifications/NotificationRenderer.test.ts
```

## Documentation task verification

- `git diff --check`: passed.
- `npm test -- tests/unit/notifications/NotificationRenderer.test.ts`: attempted, but `vitest` is unavailable in this workspace (`vitest` is not recognized as a command).
- Database, browser, and deployed Edge Function checks: not run; this task changed documentation only and did not access a remote environment.
- Files changed by this task: `docs/context/backoffice/FEATURES.md` and `docs/context/backoffice/features/internal-notifications.md` only.

## Risks and pending verification

- Remote migration, seed, Function deployment, secrets, gateway configuration, and live data cannot be confirmed from repository contents.
- No domain flow creates notifications, so the feature cannot produce real notifications without additional integration work.
- `notifications-dispatch-scheduled` and scheduled reminder execution are absent.
- `notification_preferences` and a preferences UI are absent.
- Only the internal channel is operational; email, WhatsApp, SMS, push, and gateway are schema/type placeholders.
- `expires_at` exists but current list and unread-count queries do not exclude expired rows.
- The page loads only the first 20 rows; cursor pagination exists server-side but has no UI.
- The template renderer returns plain strings but does not strip/escape HTML itself; safety currently depends on text-node rendering and must be preserved by future consumers.
- Notification insertion and delivery insertion are separate database requests, not one transaction. A delivery failure can leave a notification without a delivery; a retry with the same deduplication key can repair the internal delivery.
- Deduplication recovery looks up only the globally unique key and does not compare the existing recipient/type/entity with the new input; key construction must therefore include stable recipient and event identity.
- Only renderer unit tests were found. Dedicated tests for the central service, ownership, all four Function contracts, frontend hooks/components, polling, pagination, and destination access were not found.
- Manual browser, database, and deployed Function validation was not performed in this documentation-only task.

## Future improvements

Subject to separate feature work and design/security review:

- integrate confirmed appointment, payment, review, clinical-request, professional, plan, queue, withdrawal, and teleconsultation events;
- add the scheduled reminder dispatcher and its authenticated scheduler contract;
- add notification preferences while respecting required notification types;
- add cursor/load-more or infinite scrolling and an unread filter;
- define expiry behavior;
- add Realtime or refine polling;
- implement external dispatchers for email, WhatsApp, SMS, push, or a gateway with retries and observability;
- add a preference screen and, if needed, backoffice catalog/operations tooling;
- add service, API ownership, and frontend automated coverage.
