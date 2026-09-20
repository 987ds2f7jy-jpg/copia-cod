import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NotificationList } from '../components/NotificationList';
import { useNotifications } from '../hooks/useNotifications';

function NotificationsPageInner() {
  const { data, isLoading, isError, markRead, markAllRead } = useNotifications();
  const items = data?.items || [];
  return <main className="mx-auto max-w-3xl px-4 py-8"><Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Notificações</CardTitle><Button variant="outline" size="sm" disabled={markAllRead.isPending || !items.some((item) => !item.readAt)} onClick={() => markAllRead.mutate()}><CheckCheck className="mr-2 h-4 w-4" />Marcar todas como lidas</Button></CardHeader><CardContent className="p-0">{isLoading ? <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div> : isError ? <p className="py-12 text-center text-sm text-destructive">Não foi possível carregar notificações.</p> : <NotificationList items={items} readingId={markRead.variables} onRead={(id) => markRead.mutate(id)} />}</CardContent></Card></main>;
}

export default function NotificationsPage() { return <ProtectedRoute><NotificationsPageInner /></ProtectedRoute>; }
