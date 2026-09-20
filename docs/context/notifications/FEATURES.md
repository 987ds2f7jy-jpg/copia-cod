# Notifications Features

## Internal Notifications

Status: partially implemented

Provides an isolated internal notifications module for patients and professionals. It uses notification templates, user-specific notification records, unread counters, read status and frontend badges.

Main tables:

- `notification_types`
- `user_notifications`
- `notification_deliveries`

Edge Functions:

- `notifications-list`
- `notifications-unread-count`
- `notifications-mark-read`
- `notifications-mark-all-read`

Detailed document:

- [internal-notifications.md](internal-notifications.md)
