'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { getMessageNotificationsEnabled } from '@/lib/user-preferences';
import type { ConversationPreview, Notification } from '@/types';

interface MessagingSummaryValue {
  userId?: string;
  conversations: ConversationPreview[];
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  refreshConversations: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const emptySummary: MessagingSummaryValue = {
  conversations: [],
  notifications: [],
  unreadCount: 0,
  loading: false,
  refreshConversations: async () => undefined,
  refreshNotifications: async () => undefined,
  markAsRead: async () => undefined,
  markAllAsRead: async () => undefined,
};

const MessagingSummaryContext = createContext<MessagingSummaryValue>(emptySummary);

interface MessagingSummaryProviderProps {
  userId?: string;
  children: ReactNode;
}

export function MessagingSummaryProvider({ userId, children }: MessagingSummaryProviderProps) {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refreshConversations = useCallback(async () => {
    if (!userId) {
      setConversations([]);
      return;
    }

    const supabase = createClient();
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const token = session.session?.access_token;
    if (!token) {
      setConversations([]);
      return;
    }

    const response = await fetch('/api/messages/conversations', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Unable to load conversations');
    const data = await response.json() as { conversations?: ConversationPreview[] };
    setConversations(data.conversations ?? []);
  }, [userId]);

  const refreshNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const supabase = createClient();
    const [messageNotificationsEnabled, notificationResult] = await Promise.all([
      getMessageNotificationsEnabled(userId),
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);
    if (notificationResult.error) throw notificationResult.error;

    let unreadQuery = supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (!messageNotificationsEnabled) {
      unreadQuery = unreadQuery.or('type.is.null,type.neq.message');
    }
    const unreadResult = await unreadQuery;
    if (unreadResult.error) throw unreadResult.error;

    const visibleNotifications = (notificationResult.data ?? []).filter(
      (notification) => messageNotificationsEnabled || notification.type !== 'message',
    );
    setNotifications(visibleNotifications as Notification[]);
    setUnreadCount(unreadResult.count ?? 0);
  }, [userId]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([refreshConversations(), refreshNotifications()]);
    } catch (error) {
      console.error('Unable to refresh messaging summary:', error);
    } finally {
      setLoading(false);
    }
  }, [refreshConversations, refreshNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!userId) return;
    const { error } = await createClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) {
      console.error('Unable to mark notification as read:', error.message);
      return;
    }
    await refreshNotifications();
  }, [refreshNotifications, userId]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    const { error } = await createClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) {
      console.error('Unable to mark notifications as read:', error.message);
      return;
    }
    await refreshNotifications();
  }, [refreshNotifications, userId]);

  useEffect(() => {
    if (!userId) {
      setConversations([]);
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    let disposed = false;
    let pollingTimer: ReturnType<typeof setInterval> | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;

    const startPolling = () => {
      if (pollingTimer) return;
      pollingTimer = setInterval(() => {
        void refreshAll();
      }, 10_000);
    };
    const stopPolling = () => {
      if (!pollingTimer) return;
      clearInterval(pollingTimer);
      pollingTimer = undefined;
    };
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (!disposed) void refreshAll();
      }, 100);
    };

    void refreshAll();
    const channelStartupTimer = setTimeout(() => {
      if (disposed) return;
      channel = supabase
        .channel(`messaging-summary-${userId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        }, scheduleRefresh)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${userId}`,
        }, scheduleRefresh)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        }, scheduleRefresh)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            stopPolling();
            scheduleRefresh();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            startPolling();
          }
        });
    }, 0);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        scheduleRefresh();
      }
    };
    window.addEventListener('online', scheduleRefresh);
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      clearTimeout(channelStartupTimer);
      if (refreshTimer) clearTimeout(refreshTimer);
      stopPolling();
      window.removeEventListener('online', scheduleRefresh);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refreshAll, userId]);

  const value = useMemo<MessagingSummaryValue>(() => ({
    userId,
    conversations,
    notifications,
    unreadCount: userId ? unreadCount : 0,
    loading,
    refreshConversations,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
  }), [
    userId,
    conversations,
    notifications,
    unreadCount,
    loading,
    refreshConversations,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
  ]);

  return (
    <MessagingSummaryContext.Provider value={value}>
      {children}
    </MessagingSummaryContext.Provider>
  );
}

export function useMessagingSummary() {
  return useContext(MessagingSummaryContext);
}
