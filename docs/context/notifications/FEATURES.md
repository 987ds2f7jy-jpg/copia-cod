# Notifications Features

## Internal Notifications

Status: partially implemented — Phase 1 integrations implemented

Provides an internal notifications module for patients and professionals. It uses notification templates, user-specific notification records, unread counters, read status and frontend badges. In addition to the isolated infrastructure, core Phase 1 appointment, payment and review flows now create notifications through `InternalNotificationService`.

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
