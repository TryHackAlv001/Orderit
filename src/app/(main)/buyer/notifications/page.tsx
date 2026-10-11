'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageSquare, Package, Settings, Star } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuthStore } from '@/store/authStore';
import type { NotificationType } from '@/lib/notifications';

interface NotificationRecord {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  link?: string | null;
}

function formatTimeAgo(date: string) {
  const now = new Date();
  const notificationDate = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - notificationDate.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'order':
      return <Package className="h-5 w-5" />;
    case 'message':
      return <MessageSquare className="h-5 w-5" />;
    case 'review':
      return <Star className="h-5 w-5" />;
    default:
      return <Settings className="h-5 w-5" />;
  }
}

export default function BuyerNotificationsPage() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread' | 'orders' | 'messages'>('all');
  const { markAsRead } = useNotifications(user?.id);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString(),
      });

      if (filter === 'unread') {
        params.set('unreadOnly', 'true');
      } else if (filter === 'orders') {
        params.set('type', 'order');
      } else if (filter === 'messages') {
        params.set('type', 'message');
      }

      const response = await fetch(`/api/notifications?${params}`);

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, limit, page, user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleNotificationClick = async (notification: NotificationRecord) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
    }

    if (notification.link) {
      window.location.href = notification.link;
    }
  };

  if (!user) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p>Please log in to view notifications.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Notifications</h1>
          <p className="text-muted">Stay updated with your orders and messages.</p>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'unread', label: 'Unread' },
          { key: 'orders', label: 'Orders' },
          { key: 'messages', label: 'Messages' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              setFilter(key as 'all' | 'unread' | 'orders' | 'messages');
              setPage(1);
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              filter === key
                ? 'bg-accent/10 text-accent-text'
                : 'bg-surface-raised text-text hover:bg-surface-raised'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-4">
                <div className="animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-surface-raised" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-surface-raised rounded w-3/4" />
                      <div className="h-3 bg-surface-raised rounded w-1/2" />
                      <div className="h-3 bg-surface-raised rounded w-1/4" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-8 text-center">
            <p className="text-muted">No notifications found.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`w-full rounded-lg border p-4 text-left transition hover:shadow-sm ${
                !notification.is_read ? 'border-accent bg-accent/10' : 'border-border bg-surface'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`rounded-full p-2 ${
                    notification.type === 'order'
                      ? 'bg-accent/10 text-accent-text'
                      : notification.type === 'message'
                        ? 'bg-success/10 text-text'
                        : notification.type === 'review'
                          ? 'bg-warning/10 text-text'
                          : 'bg-surface-raised text-muted'
                  }`}
                >
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{notification.title}</p>
                  <p className="mt-1 text-sm text-muted">{notification.body}</p>
                  <p className="mt-2 text-xs text-muted">{formatTimeAgo(notification.created_at)}</p>
                </div>
                {!notification.is_read && <div className="mt-2 h-2 w-2 rounded-full bg-accent" />}
              </div>
            </button>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="rounded-full p-2 text-muted hover:text-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <span className="text-sm text-muted">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page === totalPages}
            className="rounded-full p-2 text-muted hover:text-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
