'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useMessagingSummary } from '@/hooks/useMessagingSummary';
import type {
  ConversationPreview,
  Message,
  MessageOrderContext,
  MessageProductContext,
  MessageWithRelations,
} from '@/types';

interface SendMessageOptions {
  orderId?: string | null;
  productId?: string | null;
  retryId?: string;
}

interface PendingMessage {
  content: string;
  orderId: string | null;
  productId: string | null;
}

interface CachedValue<T> {
  expiresAt: number;
  value: T | null;
}

const MESSAGE_CACHE_TTL = 30_000;

function isMessageRow(value: unknown): value is Message {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string'
    && typeof row.sender_id === 'string'
    && typeof row.receiver_id === 'string'
    && typeof row.content === 'string'
    && typeof row.created_at === 'string'
    && (row.read_at === null || typeof row.read_at === 'string')
    && typeof row.is_read === 'boolean';
}

function sortMessages(messages: MessageWithRelations[]) {
  return messages.sort((left, right) =>
    left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id),
  );
}

export function useConversations(currentUserId?: string) {
  const summary = useMessagingSummary();
  const isCurrentUser = Boolean(currentUserId && summary.userId === currentUserId);

  return {
    conversations: isCurrentUser ? summary.conversations : [],
    loading: isCurrentUser ? summary.loading : false,
    error: null as string | null,
    refresh: summary.refreshConversations,
  };
}

export function useMessages(conversationId?: string | null, currentUserId?: string | null) {
  const [messages, setMessages] = useState<MessageWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<MessageWithRelations[]>([]);
  const productCache = useRef(new Map<string, CachedValue<MessageProductContext>>());
  const orderCache = useRef(new Map<string, CachedValue<MessageOrderContext>>());
  const pendingMessages = useRef(new Map<string, PendingMessage>());
  const sendLock = useRef(false);

  const commitMessages = useCallback((
    update: (current: MessageWithRelations[]) => MessageWithRelations[],
  ) => {
    setMessages((current) => {
      const next = sortMessages(update(current));
      messagesRef.current = next;
      return next;
    });
  }, []);

  const hydrateMessages = useCallback(async (rows: Message[]): Promise<MessageWithRelations[]> => {
    const now = Date.now();
    const productIds = Array.from(new Set(rows.flatMap((row) => row.product_id ? [row.product_id] : [])));
    const orderIds = Array.from(new Set(rows.flatMap((row) => row.order_id ? [row.order_id] : [])));
    const missingProducts = productIds.filter((id) => (productCache.current.get(id)?.expiresAt ?? 0) <= now);
    const missingOrders = orderIds.filter((id) => (orderCache.current.get(id)?.expiresAt ?? 0) <= now);
    const supabase = createClient();

    if (missingProducts.length) {
      const { data, error: productError } = await supabase
        .from('products')
        .select('id,name,images,price,is_active')
        .in('id', missingProducts);
      if (productError) {
        console.error('Unable to hydrate message product context:', productError.message);
        missingProducts.forEach((id) => productCache.current.set(id, {
          expiresAt: now + MESSAGE_CACHE_TTL,
          value: null,
        }));
      } else {
        const found = new Map((data ?? []).map((product) => [product.id, product]));
        missingProducts.forEach((id) => {
          const product = found.get(id);
          productCache.current.set(id, {
            expiresAt: now + MESSAGE_CACHE_TTL,
            value: product ? {
              id: product.id,
              name: product.name,
              images: product.images ?? [],
              price: product.price,
              is_active: product.is_active,
            } : null,
          });
        });
      }
    }

    if (missingOrders.length) {
      const [{ data: orders, error: orderError }, { data: items, error: itemsError }] = await Promise.all([
        supabase
          .from('orders')
          .select('id,status,buyer_id,vendor_id')
          .in('id', missingOrders),
        supabase
          .from('order_items')
          .select('id,order_id,product_id,product_name,product_image')
          .in('order_id', missingOrders)
          .order('id', { ascending: true }),
      ]);
      if (orderError || itemsError) {
        console.error('Unable to hydrate message order context:', orderError?.message ?? itemsError?.message);
        missingOrders.forEach((id) => orderCache.current.set(id, {
          expiresAt: now + MESSAGE_CACHE_TTL,
          value: null,
        }));
      } else {
        const firstItem = new Map<string, NonNullable<MessageOrderContext['first_item']>>();
        for (const item of items ?? []) {
          if (!firstItem.has(item.order_id)) {
            firstItem.set(item.order_id, {
              product_id: item.product_id,
              product_name: item.product_name,
              product_image: item.product_image,
            });
          }
        }
        const found = new Map((orders ?? []).map((order) => [order.id, order]));
        missingOrders.forEach((id) => {
          const order = found.get(id);
          orderCache.current.set(id, {
            expiresAt: now + MESSAGE_CACHE_TTL,
            value: order ? {
              id: order.id,
              status: order.status,
              buyer_id: order.buyer_id,
              vendor_id: order.vendor_id,
              first_item: firstItem.get(id) ?? null,
            } : null,
          });
        });
      }
    }

    return rows.map((row) => ({
      ...row,
      product_context: row.product_id
        ? productCache.current.get(row.product_id)?.value ?? null
        : null,
      order_context: row.order_id
        ? orderCache.current.get(row.order_id)?.value ?? null
        : null,
    }));
  }, []);

  const fetchMessages = useCallback(async (after?: string, showLoading = false) => {
    if (!conversationId || !currentUserId) {
      messagesRef.current = [];
      setMessages([]);
      setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      let query = supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${conversationId}),and(sender_id.eq.${conversationId},receiver_id.eq.${currentUserId})`)
        .order('created_at', { ascending: true });
      if (after) query = query.gte('created_at', after);
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      const rows = (data ?? []).filter(isMessageRow);
      const hydrated = await hydrateMessages(rows);
      commitMessages((current) => {
        const merged = new Map(current.map((message) => [message.id, message]));
        hydrated.forEach((message) => merged.set(message.id, {
          ...merged.get(message.id),
          ...message,
        }));
        return Array.from(merged.values());
      });
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Unable to load messages';
      setError(message);
      console.error('Unable to load messages:', message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [commitMessages, conversationId, currentUserId, hydrateMessages]);

  const markAsRead = useCallback(async () => {
    if (!conversationId || !currentUserId
      || document.visibilityState !== 'visible'
      || !document.hasFocus()) return;

    const supabase = createClient();
    const { error: readError } = await supabase.rpc('mark_messages_read', {
      other_user_id: conversationId,
      order_id: null,
    });
    if (readError) {
      console.error('Unable to mark messages as read:', readError.message);
      return;
    }
    commitMessages((current) => current.map((message) =>
      message.sender_id === conversationId && message.receiver_id === currentUserId
        ? { ...message, is_read: true }
        : message,
    ));
  }, [commitMessages, conversationId, currentUserId]);

  const sendMessage = useCallback(async (
    content: string,
    options: SendMessageOptions = {},
  ): Promise<boolean> => {
    if (!conversationId || !currentUserId || sendLock.current) return false;
    const cleanContent = content.trim();
    if (!cleanContent || cleanContent.length > 2000) return false;
    sendLock.current = true;

    const localId = options.retryId ?? crypto.randomUUID();
    const pending = {
      content: cleanContent,
      orderId: options.orderId ?? null,
      productId: options.productId ?? null,
    };
    pendingMessages.current.set(localId, pending);

    if (options.retryId) {
      commitMessages((current) => current.map((message) => message.id === localId
        ? { ...message, delivery_status: 'sending', send_error: undefined }
        : message,
      ));
    } else {
      const optimistic: MessageWithRelations = {
        id: localId,
        sender_id: currentUserId,
        receiver_id: conversationId,
        content: cleanContent,
        order_id: pending.orderId,
        product_id: pending.productId,
        product_snapshot: null,
        is_read: false,
        read_at: null,
        created_at: new Date().toISOString(),
        delivery_status: 'sending',
      };
      commitMessages((current) => [...current, optimistic]);
    }

    try {
      const { data, error: sendError } = await createClient().rpc('send_message', {
        receiver_id: conversationId,
        content: cleanContent,
        order_id: pending.orderId,
        product_id: pending.productId,
      });
      if (sendError) throw sendError;
      const row = Array.isArray(data) ? data[0] : data;
      if (!isMessageRow(row)) throw new Error('The server returned an invalid message');
      const [hydrated] = await hydrateMessages([row]);
      pendingMessages.current.delete(localId);
      commitMessages((current) => [
        ...current.filter((message) => message.id !== localId && message.id !== hydrated.id),
        hydrated,
      ]);
      return true;
    } catch (sendError) {
      const reason = sendError instanceof Error ? sendError.message : 'Unable to send message';
      commitMessages((current) => current.map((message) => message.id === localId
        ? { ...message, delivery_status: 'failed', send_error: reason }
        : message,
      ));
      return false;
    } finally {
      sendLock.current = false;
    }
  }, [commitMessages, conversationId, currentUserId, hydrateMessages]);

  const retryMessage = useCallback(async (messageId: string) => {
    const message = messagesRef.current.find((item) => item.id === messageId);
    const pending = pendingMessages.current.get(messageId);
    if (!message || !pending) return;
    await sendMessage(pending.content, {
      orderId: pending.orderId,
      productId: pending.productId,
      retryId: messageId,
    });
  }, [sendMessage]);

  useEffect(() => {
    messagesRef.current = [];
    pendingMessages.current.clear();
    productCache.current.clear();
    orderCache.current.clear();
    setMessages([]);
    if (!conversationId || !currentUserId) {
      setLoading(false);
      return;
    }

    let disposed = false;
    let subscribed = false;
    let pollingTimer: ReturnType<typeof setInterval> | undefined;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    const fetchCatchup = async (showLoading = false) => {
      if (disposed) return;
      const latest = messagesRef.current.reduce<string | undefined>(
        (value, message) => !value || message.created_at > value ? message.created_at : value,
        undefined,
      );
      await fetchMessages(latest, showLoading);
    };
    const startPolling = () => {
      if (pollingTimer) return;
      pollingTimer = setInterval(() => void fetchCatchup(), 10_000);
    };
    const stopPolling = () => {
      if (!pollingTimer) return;
      clearInterval(pollingTimer);
      pollingTimer = undefined;
    };
    const handleChange = (payload: { eventType: string; new: unknown }) => {
      if (!isMessageRow(payload.new)) return;
      const row = payload.new;
      if (!(
        (row.sender_id === currentUserId && row.receiver_id === conversationId)
        || (row.sender_id === conversationId && row.receiver_id === currentUserId)
      )) return;

      if (payload.eventType === 'UPDATE') {
        commitMessages((current) => current.map((message) => message.id === row.id
          ? { ...message, ...row }
          : message,
        ));
        return;
      }

      void hydrateMessages([row]).then(([hydrated]) => {
        if (disposed) return;
        commitMessages((current) => {
          if (current.some((message) => message.id === hydrated.id)) return current;
          const optimisticEntry = current.find((message) =>
            message.delivery_status === 'sending'
            && message.sender_id === hydrated.sender_id
            && message.receiver_id === hydrated.receiver_id
            && message.content === hydrated.content
            && message.order_id === hydrated.order_id
            && message.product_id === hydrated.product_id,
          );
          return optimisticEntry
            ? current.map((message) => message.id === optimisticEntry.id ? hydrated : message)
            : [...current, hydrated];
        });
      }).catch((hydrateError: unknown) => {
        console.error('Unable to hydrate incoming message:', hydrateError);
      });
    };

    setLoading(true);
    void fetchMessages(undefined, true);
    const channelStartupTimer = setTimeout(() => {
      if (disposed) return;
      channel = supabase
        .channel(`chat-${currentUserId}-${conversationId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${conversationId}`,
        }, handleChange)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${conversationId}`,
        }, handleChange)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${conversationId}`,
        }, handleChange)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${conversationId}`,
        }, handleChange)
        .subscribe((status) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') {
            subscribed = true;
            stopPolling();
            void fetchCatchup();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            subscribed = false;
            console.error(`Message Realtime channel ${status.toLowerCase()}`);
            startPolling();
          }
        });
    }, 0);

    const recover = () => {
      productCache.current.clear();
      orderCache.current.clear();
      void fetchCatchup();
      if (!subscribed) startPolling();
    };
    window.addEventListener('online', recover);
    window.addEventListener('focus', recover);
    document.addEventListener('visibilitychange', recover);

    return () => {
      disposed = true;
      clearTimeout(channelStartupTimer);
      stopPolling();
      window.removeEventListener('online', recover);
      window.removeEventListener('focus', recover);
      document.removeEventListener('visibilitychange', recover);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [commitMessages, conversationId, currentUserId, fetchMessages, hydrateMessages]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    retryMessage,
    markAsRead,
    refresh: fetchMessages,
  };
}
