import type { ReactNode } from 'react';

export function NotificationAvatarBadge({ unreadCount, children }: { unreadCount: number; children: ReactNode }) {
  return <span className="relative inline-flex">{children}{unreadCount > 0 && <span aria-label={`${unreadCount} notificações não lidas`} className="absolute -right-1 -top-1 min-w-4 h-4 rounded-full bg-red-500 border-2 border-background text-[9px] leading-3 text-center text-white font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>}</span>;
}
