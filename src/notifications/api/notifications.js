import { invokeEdgeFunction } from '@/client-api/edgeFunctions';

export const listNotifications = ({ limit = 20, cursor = null, unread = false } = {}) =>
  invokeEdgeFunction('notifications-list', { body: { limit, cursor, unread }, fallbackMessage: 'Não foi possível carregar notificações.' });

export const getUnreadNotificationsCount = () =>
  invokeEdgeFunction('notifications-unread-count', { body: {}, fallbackMessage: 'Não foi possível carregar notificações.' });

export const markNotificationAsRead = (notificationId) =>
  invokeEdgeFunction('notifications-mark-read', { body: { notificationId }, fallbackMessage: 'Não foi possível atualizar a notificação.' });

export const markAllNotificationsAsRead = () =>
  invokeEdgeFunction('notifications-mark-all-read', { body: {}, fallbackMessage: 'Não foi possível atualizar as notificações.' });
