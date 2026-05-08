import { supabaseAdminClient } from './supabase-admin';

export type NotificationType = 'order' | 'message' | 'review' | 'system';

export interface NotificationData {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  link?: string;
}

/**
 * Creates a new notification for a user
 */
export async function createNotification({
  userId,
  title,
  body,
  type,
  link,
}: NotificationData) {
  const { data, error } = await supabaseAdminClient
    .from('notifications')
    .insert([
      {
        user_id: userId,
        title,
        body,
        type,
        link,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating notification:', error);
    throw new Error('Failed to create notification');
  }

  return data;
}

/**
 * Marks a specific notification as read
 */
export async function markAsRead(notificationId: string, userId: string) {
  const { error } = await supabaseAdminClient
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error marking notification as read:', error);
    throw new Error('Failed to mark notification as read');
  }
}

/**
 * Marks all notifications as read for a user
 */
export async function markAllAsRead(userId: string) {
  const { error } = await supabaseAdminClient
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error marking all notifications as read:', error);
    throw new Error('Failed to mark all notifications as read');
  }
}

/**
 * Gets notifications for a user with pagination
 */
export async function getNotifications(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    type?: NotificationType;
  } = {}
) {
  const { limit = 20, offset = 0, unreadOnly = false, type } = options;

  let query = supabaseAdminClient
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching notifications:', error);
    throw new Error('Failed to fetch notifications');
  }

  return {
    notifications: data || [],
    total: count || 0,
  };
}

/**
 * Gets the count of unread notifications for a user
 */
export async function getUnreadCount(userId: string) {
  const { count, error } = await supabaseAdminClient
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }

  return count || 0;
}