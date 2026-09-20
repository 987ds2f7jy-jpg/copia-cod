# Backoffice Features

This is the quick index. Architecture rules are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Admin Authentication

Status: implemented

Provides isolated admin login through `admin_users`, a dedicated JWT, and local session `rd.backoffice.session.v1`. The admin identity and session are not shared with patients or professionals.

Routes:

- `/admin/login`
- `/admin/backoffice` (protected shell; redirects to pending registrations)

Detailed document:

- [features/admin-authentication.md](features/admin-authentication.md)

## Pending Professional Registrations

Status: implemented

Lists `professional_profiles.status = 'pending'` and lets an authenticated admin approve or reject the private profile through a transactional RPC. The operation synchronizes an eligible public projection and records audit data.

Routes:

- `/admin/backoffice/pending-registrations`

Detailed document:

- [features/pending-professional-registrations.md](features/pending-professional-registrations.md)

## Analytics Dashboard

Status: implemented

Displays three global aggregates: registered professionals, registered users, and consultations whose status is `finalizada`. It returns counts only, not full record lists.

Routes:

- `/admin/backoffice/analytics`

Detailed document:

- [features/analytics-dashboard.md](features/analytics-dashboard.md)

## Services Management

Status: implemented

Allows backoffice admins to list platform service prices, update service and duty values, and activate or deactivate existing rules in `platform_service_prices`. Updates and audit events are committed atomically.

Routes:

- `/admin/backoffice/services`

Detailed document:

- [features/services-management.md](features/services-management.md)

## Related Modules

### Internal Notifications

Status: partially implemented

Standalone module used by patients and professionals for internal notifications, unread counters, read status and notification badges.

Documentation:

- [../notifications/internal-notifications.md](../notifications/internal-notifications.md)
