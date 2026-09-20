export const NOTIFICATION_CATEGORIES = [
  'appointment', 'financial', 'review', 'clinical_request', 'professional',
  'plan', 'queue', 'teleconsulta', 'system',
] as const;

export const NOTIFICATION_CHANNELS = ['internal', 'email', 'whatsapp', 'sms', 'push', 'gateway'] as const;

export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[number];
export type NotificationChannel = typeof NOTIFICATION_CHANNELS[number];

export type NotifyInput = {
  recipientUserId: string;
  typeKey: string;
  data?: Record<string, unknown>;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  deduplicationKey?: string | null;
  channels?: NotificationChannel[];
  expiresAt?: string | null;
};

export type NotificationTypeRecord = {
  id: string;
  key: string;
  category: NotificationCategory;
  title_template: string;
  message_template: string;
  default_channels: unknown;
  is_active: boolean;
};
