'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getMessageNotificationsEnabled } from '@/lib/user-preferences';

type Notification = {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  link: string;
  created_at: string;
};

export function useNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<any>(null);
  const messagesEnabledRef = useRef(true);

  const fetchRecentNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
    const supabase = createClient();
    const [{ data, error }, messagesEnabled] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      getMessageNotificationsEnabled(userId),
    ]);
    if (error) throw error;
    messagesEnabledRef.current = messagesEnabled;
      const visibleNotifications = (data ?? []).filter(
        (notification: Notification) => messagesEnabledRef.current || notification.type !== 'message'
      );
      setNotifications(visibleNotifications);
      setUnreadCount(visibleNotifications.filter((notification: Notification) => !notification.is_read).length);
    } catch (err) {
      console.error('fetchNotifications error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    const supabase = createClient();
    await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  useEffect(() => {
    if (!userId) return;
    fetchRecentNotifications();

    const supabase = createClient();

    // Remove existing channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`notif-${userId}-${Date.now()}`);
    
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      const notification = payload.new as Notification;
      if (notification.type !== 'message' || messagesEnabledRef.current) {
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
      }
    });

    channel.subscribe();
    channelRef.current = channel;
    const handlePreferenceChange = (event: Event) => {
      const enabled = (event as CustomEvent<{ notify_messages?: unknown }>).detail?.notify_messages;
      if (typeof enabled !== 'boolean') return;
      messagesEnabledRef.current = enabled;
      void fetchRecentNotifications();
    };
    window.addEventListener('user-preferences-changed', handlePreferenceChange);

    return () => {
      window.removeEventListener('user-preferences-changed', handlePreferenceChange);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, fetchRecentNotifications]);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch: fetchRecentNotifications };
}
