import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUnreadNotificationsCount } from '../hooks/useUnreadNotificationsCount';

export function NotificationBell() {
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();
  return <Link to="/Notifications" aria-label="Notificações" className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"><Bell className="h-5 w-5" />{unreadCount > 0 && <span className="absolute right-0 top-0 min-w-4 h-4 rounded-full bg-red-500 text-[9px] leading-4 text-center text-white font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>}</Link>;
}
