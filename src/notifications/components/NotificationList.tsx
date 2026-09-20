import type { UserNotification } from '../types';
import { useNavigate } from 'react-router-dom';
import { notificationDestination } from '../utils';

export function NotificationList({ items, onRead, readingId }: { items: UserNotification[]; onRead: (id: string) => void; readingId?: string }) {
  const navigate = useNavigate();
  if (!items.length) return <p className="py-12 text-center text-sm text-muted-foreground">Você não tem notificações.</p>;
  return <div className="divide-y divide-border">{items.map((item) => { const destination = notificationDestination(item); return <article key={item.id} className={`p-4 ${item.readAt ? '' : 'bg-emerald-50/50 dark:bg-emerald-950/20'}`}><div className="flex gap-3 justify-between"><div className={destination ? 'cursor-pointer' : ''} onClick={() => destination && navigate(destination)}><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.category}</p><p className="mt-1 font-medium text-sm">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.message}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString('pt-BR')}</p></div>{!item.readAt && <button disabled={readingId === item.id} onClick={() => onRead(item.id)} className="shrink-0 text-xs text-emerald-700 hover:underline disabled:opacity-50">Marcar como lida</button>}</div></article>; })}</div>;
}
