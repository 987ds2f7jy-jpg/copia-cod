import { useQuery } from '@tanstack/react-query';
import { getUnreadNotificationsCount } from '../api/notifications';

export function useUnreadNotificationsCount(enabled = true) {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadNotificationsCount,
    enabled,
    staleTime: 15_000,
    refetchInterval: 60_000,
    select: (result) => Number(result?.unreadCount || 0),
  });
}
