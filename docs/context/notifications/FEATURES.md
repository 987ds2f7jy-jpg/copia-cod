# Notifications Features

## Internal Notifications

Status: partially implemented — Phase 1, Phase 2, Phase 3A, and scoped Phase 3B integrations implemented

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
