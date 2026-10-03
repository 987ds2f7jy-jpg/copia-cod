# Notifications Features

## Internal Notifications

Status: partially implemented — Phase 1, Phase 2, Phase 3A, scoped Phase 3B, and Plans-on-internal-runtime integrations implemented

Provides an internal notifications module for patients and professionals. It uses notification templates, user-specific notification records, unread counters, read status and frontend badges. Confirmed Phase 1, Phase 2, Phase 3A, and scoped Phase 3B flows create notifications through `InternalNotificationService`.

Main tables:

- `notification_types`
- `user_notifications`
- `notification_deliveries`

Edge Functions:

- `notifications-list`
- `notifications-unread-count`
- `notifications-mark-read`
- `notifications-mark-all-read`
- `notifications-dispatch-scheduled`

Phase 1 integrations:

- `appointment.created` for the patient;
- `appointment.received` for a directly selected professional;
- `appointment.accepted` for the patient;
- `financial.payment_approved` for the payment owner;
- `review.professional_pending` for the patient after a consultation transitions to finished.

Phase 2 integrations:

- `appointment.cancelled` for the patient/professional counterpart when one exists;
- `financial.payment_failed`, `financial.payment_expired`, and `financial.refund_processed` for the payment owner;
- `review.received` for the consultation professional through the primary evaluation flow;
- `professional.registration_approved` and `professional.registration_rejected` for the reviewed professional;
- `clinical_request.created` and `clinical_request.accepted` for the patient.

Phase 3A integrations:

- `teleconsulta.started` and `teleconsulta.finished` for the consultation patient;
- `queue.joined` and `queue.accepted` for the queue patient;
- `financial.withdrawal_requested` for the requesting professional;
- `plan.activated` for the order app user;
- `plan.credit_consumed` for the patient, only from appointment/queue `used_now` branches with a stable usage ID.

Phase 3B integrations:

- `professional.registration_submitted` for the newly registered professional, after both required profiles are persisted;
- `plan.activation_failed` for the plan-order owner, after the activation-failure state is persisted;
- `appointment.reminder_day` for the patient and, when assigned, the professional, through the protected daily dispatcher.

The daily dispatcher uses `America/Sao_Paulo`, accepts only eligible scheduled appointments for the local day, and is intended to be invoked at 04:00 local time. The remote cron job and `NOTIFICATIONS_SCHEDULER_SECRET` must be configured in each Supabase environment.

Plans notifications on the internal Plans runtime:

- `plan.credit_reserved` for the patient after an appointment/queue `plan_credit_usage` is durably persisted as `pending_use`;
- `plan.coverage_denied` for the patient after a concrete appointment/queue attempt is persisted without eligible internal coverage; read-only `check-plan-coverage` calls do not emit;
- `plan.expiring` is registered, but has no emitter because `plan_subscriptions` has no canonical expiration timestamp or warning-window product rule;
- `plan.expired` is registered, but has no emitter because the Plans domain has no subscription-expiration transition; score expiration is deliberately not treated as plan expiration;
- `plan.cancelled` is registered, but has no emitter because the internal Plans domain has no cancellation service/RPC/caller.

These events use `PlansFacade` / `InternalPlansProvider` state. They do not depend on the retired external Plans HTTP runtime.

Detailed document:

- [internal-notifications.md](internal-notifications.md)

## Documentation Rule

Whenever a new domain flow starts calling `InternalNotificationService`, update this document with:

- domain;
- event;
- typeKey;
- recipient;
- trigger file/function;
- related entity;
- deduplication key format;
- whether the event is synchronous, webhook-driven or scheduled.
