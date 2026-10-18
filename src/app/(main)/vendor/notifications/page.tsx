'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Bell, Check } from 'lucide-react';
import { getMessageNotificationsEnabled } from '@/lib/user-preferences';
import { MARKETPLACE_ROUTE } from '@/constants';

type Notification = {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  link: string;
  created_at: string;
};

export default function VendorNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(MARKETPLACE_ROUTE); return; }

      const [{ data, error }, messagesEnabled] = await Promise.all([
        supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
        getMessageNotificationsEnabled(user.id),
      ]);
      if (error) {
        console.error('Unable to load vendor notifications:', error.message);
        setLoading(false);
        return;
      }

      setNotifications((data ?? []).filter(
        (notification: Notification) => messagesEnabled || notification.type !== 'message'
      ));
      setLoading(false);
    };
    load();
  }, [router]);

  const markAllRead = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-2xl min-w-0 py-8 md:px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text flex items-center gap-2">
          <Bell className="h-6 w-6 text-accent-text" />
          Notifications
        </h1>
        {notifications.some(n => !n.is_read) && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 text-sm text-accent-text hover:underline"
          >
            <Check className="h-4 w-4" />
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <Bell className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => n.link && router.push(n.link)}
              className={`p-4 rounded-lg border cursor-pointer transition hover:shadow-sm ${
                n.is_read
                  ? 'bg-surface border-border text-muted'
                  : 'bg-accent/10 border-accent text-text'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">{n.title}</p>
                  {n.body && <p className="text-sm mt-1 opacity-80">{n.body}</p>}
                </div>
                {!n.is_read && (
                  <span className="w-2 h-2 rounded-full bg-accent mt-1 flex-shrink-0" />
                )}
              </div>
              <p className="text-xs mt-2 opacity-50">
                {new Date(n.created_at).toLocaleDateString('en-NG', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
