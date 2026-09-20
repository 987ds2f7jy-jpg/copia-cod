import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listNotifications, markAllNotificationsAsRead, markNotificationAsRead } from '../api/notifications';

const LIST_KEY = ['notifications', 'list'];
const COUNT_KEY = ['notifications', 'unread-count'];

export function useNotifications(options = {}) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: [...LIST_KEY, options], queryFn: () => listNotifications(options), staleTime: 15_000 });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: LIST_KEY });
    queryClient.invalidateQueries({ queryKey: COUNT_KEY });
  };
  const markRead = useMutation({ mutationFn: markNotificationAsRead, onSuccess: invalidate });
  const markAllRead = useMutation({ mutationFn: markAllNotificationsAsRead, onSuccess: invalidate });
  return { ...query, markRead, markAllRead };
}
