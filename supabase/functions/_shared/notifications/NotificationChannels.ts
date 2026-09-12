import type { NotificationChannel } from './NotificationTypes.ts';

export function resolveNotificationChannels(input: unknown): NotificationChannel[] {
  const values = Array.isArray(input) ? input : ['internal'];
  const allowed = new Set<NotificationChannel>(['internal', 'email', 'whatsapp', 'sms', 'push', 'gateway']);
  const channels = values.filter((value): value is NotificationChannel => typeof value === 'string' && allowed.has(value as NotificationChannel));
  // MVP deliberately creates only an internal delivery. Future channel dispatchers
  // can consume the same notification without changing business flows.
  return channels.includes('internal') ? ['internal'] : ['internal'];
}
