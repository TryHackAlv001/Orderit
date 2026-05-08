'use client';

import { useEffect, useState, useCallback } from "react";
import { supabaseBrowserClient } from "@/lib/supabase";
import type { ConversationPreview, Message, MessageWithRelations } from "@/types";

export function useConversations(currentUserId?: string) {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!currentUserId) {
      setConversations([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/messages/conversations", {
        headers: {
          'Authorization': `Bearer ${(await supabaseBrowserClient.auth.getSession()).data.session?.access_token}`,
        },
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || "Unable to load conversations");
      }

      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load conversations");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    fetchConversations();

    // Subscribe to new messages to refresh conversations
    const channel = supabaseBrowserClient.channel(`conversations-${currentUserId}`);

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `or=(sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId})`,
        },
        () => {
          // Refresh conversations when a new message is sent or received
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `or=(sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId})`,
        },
        () => {
          // Refresh conversations when messages are marked as read
          fetchConversations();
        }
      );

    supabaseBrowserClient.addChannel(channel);
    channel.subscribe();

    return () => {
      supabaseBrowserClient.removeChannel(channel);
    };
  }, [currentUserId, fetchConversations]);

  return {
    conversations,
    loading,
    error,
    refresh: fetchConversations,
  };
}

export function useMessages(conversationId?: string | null, currentUserId?: string | null) {
  const [messages, setMessages] = useState<MessageWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !currentUserId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error } = await supabaseBrowserClient
      .from('messages')
      .select(
        `*, sender:sender_id(id,full_name,avatar_url,role), receiver:receiver_id(id,full_name,avatar_url,role), order:order_id(id)`
      )
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${conversationId}),and(sender_id.eq.${conversationId},receiver_id.eq.${currentUserId})`
      )
      .order('created_at', { ascending: true });

    if (error) {
      setError(error.message);
      setMessages([]);
    } else {
      setMessages(data || []);
    }

    setLoading(false);
  }, [conversationId, currentUserId]);

  const markAsRead = useCallback(
    async (messageIds: string[]) => {
      if (!messageIds.length || !currentUserId) {
        return;
      }

      try {
        const response = await fetch('/api/messages/mark-read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabaseBrowserClient.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ messageIds }),
        });

        if (!response.ok) {
          throw new Error('Failed to mark messages as read');
        }
      } catch (error) {
        console.error('Unable to mark messages as read', error);
      }
    },
    [currentUserId]
  );

  const sendMessage = useCallback(
    async (content: string, orderId?: string) => {
      if (!currentUserId || !conversationId) {
        throw new Error('Not authenticated or no conversation selected');
      }

      const { data, error } = await supabaseBrowserClient
        .from('messages')
        .insert([
          {
            sender_id: currentUserId,
            receiver_id: conversationId,
            content,
            order_id: orderId ?? null,
          },
        ])
        .select(
          `*, sender:sender_id(id,full_name,avatar_url,role), receiver:receiver_id(id,full_name,avatar_url,role), order:order_id(id)`
        )
        .single();

      if (error || !data) {
        throw new Error(error?.message || 'Unable to send message');
      }

      // The realtime subscription will handle adding the message to the list
      return data;
    },
    [currentUserId, conversationId]
  );

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!conversationId || !currentUserId) {
      return;
    }

    const channel = supabaseBrowserClient.channel(`conversation-${currentUserId}-${conversationId}`);

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `or=(and(sender_id.eq.${currentUserId},receiver_id.eq.${conversationId}),and(sender_id.eq.${conversationId},receiver_id.eq.${currentUserId}))`,
        },
        (payload) => {
          const newMessage = payload.new as MessageWithRelations;
          setMessages((current) => {
            // Check if message already exists to avoid duplicates
            if (current.some(msg => msg.id === newMessage.id)) {
              return current;
            }
            return [...current, newMessage];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `or=(and(sender_id.eq.${currentUserId},receiver_id.eq.${conversationId}),and(sender_id.eq.${conversationId},receiver_id.eq.${currentUserId}))`,
        },
        (payload) => {
          const updatedMessage = payload.new as MessageWithRelations;
          setMessages((current) =>
            current.map((msg) =>
              msg.id === updatedMessage.id ? updatedMessage : msg
            )
          );
        }
      );

    supabaseBrowserClient.addChannel(channel);
    channel.subscribe();

    return () => {
      supabaseBrowserClient.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const unreadMessageIds = messages
      .filter((message) => !message.is_read && message.receiver_id === currentUserId)
      .map((message) => message.id);

    if (unreadMessageIds.length > 0) {
      markAsRead(unreadMessageIds);
    }
  }, [messages, currentUserId, markAsRead]);

  const orderId = messages.reduce<string | undefined>((currentOrder, message) => {
    if (!currentOrder && message.order_id) {
      return message.order_id;
    }
    return currentOrder;
  }, undefined);

  return {
    messages,
    loading,
    error,
    sendMessage: async (content: string, orderId?: string) => {
      return sendMessage(content, orderId);
    },
    markAsRead,
    orderId,
    refresh: fetchMessages,
  };
}
      supabaseBrowserClient.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const unreadMessageIds = messages
      .filter((message) => !message.is_read && message.receiver_id === currentUserId)
      .map((message) => message.id);

    if (unreadMessageIds.length > 0) {
      markAsRead(unreadMessageIds);
      setMessages((current) =>
        current.map((message) =>
          unreadMessageIds.includes(message.id) ? { ...message, is_read: true } : message
        )
      );
    }
  }, [messages, currentUserId, markAsRead]);

  const orderId = messages.reduce<string | undefined>((currentOrder, message) => {
    if (!currentOrder && message.order_id) {
      return message.order_id;
    }
    return currentOrder;
  }, undefined);

  return {
    messages,
    loading,
    error,
    sendMessage: async (content: string, orderId?: string) => {
      if (!conversationId) {
        throw new Error("No conversation selected");
      }
      return sendMessage(conversationId, content, orderId);
    },
    markAsRead,
    orderId,
    refresh: fetchMessages,
  };
}
