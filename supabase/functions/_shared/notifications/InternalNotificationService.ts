import { AppError } from '../errors.ts';
import type { SupabaseClient } from '../supabase.ts';
import { resolveNotificationChannels } from './NotificationChannels.ts';
import { renderNotificationTemplate } from './NotificationRenderer.ts';
import type { NotificationTypeRecord, NotifyInput } from './NotificationTypes.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_DATA_KEY = /^[a-z][a-z0-9_]{0,63}$/i;
const SENSITIVE_DATA_KEY = /(prontu|laudo|exame|diagnost|medical|result|transcri|prescri|cpf|email|phone|telefone)/i;

function sanitizeNotificationData(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key, item]) => SAFE_DATA_KEY.test(key) && !SENSITIVE_DATA_KEY.test(key) && ['string', 'number', 'boolean'].includes(typeof item))
    .map(([key, item]) => [key, typeof item === 'string' ? item.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 160) : item]));
}

export class InternalNotificationService {
  constructor(private readonly client: SupabaseClient) {}

  private async ensureInternalDeliveries(notificationId: string, channels: string[]) {
    const { error } = await this.client.from('notification_deliveries').upsert(
      channels.map((channel) => ({
        user_notification_id: notificationId,
        channel,
        status: channel === 'internal' ? 'sent' : 'pending',
        sent_at: channel === 'internal' ? new Date().toISOString() : null,
      })),
      { onConflict: 'user_notification_id,channel', ignoreDuplicates: true },
    );
    if (error) throw new AppError({ status: 500, code: 'NOTIFICATION_DELIVERY_CREATE_FAILED', message: 'Unable to create notification.' });
  }

  async notify(input: NotifyInput) {
    if (!UUID.test(input.recipientUserId)) {
      throw new AppError({ status: 422, code: 'NOTIFICATION_RECIPIENT_INVALID', message: 'Notification recipient is invalid.' });
    }
    if (!input.typeKey.trim()) {
      throw new AppError({ status: 422, code: 'NOTIFICATION_TYPE_INVALID', message: 'Notification type is invalid.' });
    }
    if (input.relatedEntityId && !UUID.test(input.relatedEntityId)) {
      throw new AppError({ status: 422, code: 'NOTIFICATION_RELATED_ENTITY_INVALID', message: 'Related entity is invalid.' });
    }

    const { data: notificationType, error: typeError } = await this.client
      .from('notification_types')
      .select('id, key, category, title_template, message_template, default_channels, is_active')
      .eq('key', input.typeKey.trim())
      .maybeSingle();
    if (typeError) throw new AppError({ status: 500, code: 'NOTIFICATION_TYPE_LOOKUP_FAILED', message: 'Unable to create notification.' });
    if (!notificationType) throw new AppError({ status: 404, code: 'NOTIFICATION_TYPE_NOT_FOUND', message: 'Notification type was not found.' });
    const type = notificationType as NotificationTypeRecord;
    if (!type.is_active) return { notification: null, deduplicated: false, skipped: true };

    const data = sanitizeNotificationData(input.data);
    const insert = {
      recipient_user_id: input.recipientUserId,
      notification_type_id: type.id,
      category: type.category,
      title: renderNotificationTemplate(type.title_template, data),
      message: renderNotificationTemplate(type.message_template, data),
      data,
      related_entity_type: input.relatedEntityType?.trim() || null,
      related_entity_id: input.relatedEntityId || null,
      deduplication_key: input.deduplicationKey?.trim() || null,
      expires_at: input.expiresAt || null,
    };
    const { data: created, error: createError } = await this.client.from('user_notifications').insert(insert).select('*').single();
    if (createError) {
      if (createError.code === '23505' && insert.deduplication_key) {
        const { data: existing, error: existingError } = await this.client
          .from('user_notifications').select('*').eq('deduplication_key', insert.deduplication_key).single();
        if (!existingError && existing) {
          await this.ensureInternalDeliveries(existing.id, resolveNotificationChannels(input.channels || type.default_channels));
          return { notification: existing, deduplicated: true, skipped: false };
        }
      }
      throw new AppError({ status: 500, code: 'NOTIFICATION_CREATE_FAILED', message: 'Unable to create notification.' });
    }

    const channels = resolveNotificationChannels(input.channels || type.default_channels);
    await this.ensureInternalDeliveries(created.id, channels);
    return { notification: created, deduplicated: false, skipped: false };
  }
}
