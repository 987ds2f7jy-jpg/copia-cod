# Notifications Features

## Internal Notifications

Status: partially implemented — Phase 1, Phase 2, and safe Phase 3A integrations implemented

Provides an internal notifications module for patients and professionals. It uses notification templates, user-specific notification records, unread counters, read status and frontend badges. Confirmed Phase 1, Phase 2, and safe Phase 3A flows create notifications through `InternalNotificationService`.

Main tables:

- `notification_types`
- `user_notifications`
- `notification_deliveries`

Edge Functions:

- `notifications-list`
- `notifications-unread-count`
- `notifications-mark-read`
- `notifications-mark-all-read`

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
