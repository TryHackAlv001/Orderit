'use client';

import { useMessagingSummary } from '@/hooks/useMessagingSummary';

export function useNotifications(userId?: string) {
  const summary = useMessagingSummary();
  if (!userId || summary.userId !== userId) {
    return {
      notifications: [],
      unreadCount: 0,
      loading: false,
      markAsRead: async (_notificationId: string) => undefined,
      markAllAsRead: async () => undefined,
      refetch: async () => undefined,
    };
  }

  return {
    notifications: summary.notifications,
    unreadCount: summary.unreadCount,
    loading: summary.loading,
    markAsRead: summary.markAsRead,
    markAllAsRead: summary.markAllAsRead,
    refetch: summary.refreshNotifications,
  };
}
