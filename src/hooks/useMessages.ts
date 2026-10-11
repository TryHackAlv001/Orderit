'use client';

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ConversationPreview, Message, MessageWithRelations } from "@/types";

export function useConversations(currentUserId?: string) {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!currentUserId) { setConversations([]); return; }
    setLoading(true);
    setError(null);
    try {
      const session = await createClient().auth.getSession();
      const token = session.data.session?.access_token;
      const response = await fetch("/api/messages/conversations", {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Unable to load conversations");
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load conversations");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    fetchConversations();
    const supabase = createClient();
    const channel = supabase
      .channel(`conversations-${currentUserId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'messages',
      }, () => fetchConversations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, fetchConversations]);

  return { conversations, loading, error, refresh: fetchConversations };
}

export function useMessages(conversationId?: string | null, currentUserId?: string | null) {
  const [messages, setMessages] = useState<MessageWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !currentUserId) { setMessages([]); return; }
    setLoading(true);
    setError(null);
    const { data, error } = await createClient()
      .from('messages')
      .select('*, sender:users!messages_sender_id_fkey(id,full_name,avatar_url,role,vendor_profiles(user_id,shop_name,logo_url)), receiver:users!messages_receiver_id_fkey(id,full_name,avatar_url,role,vendor_profiles(user_id,shop_name,logo_url)), order:orders!messages_order_id_fkey(id)')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${conversationId}),and(sender_id.eq.${conversationId},receiver_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true });
    if (error) { setError(error.message); setMessages([]); }
    else { setMessages(data || []); }
    setLoading(false);
  }, [conversationId, currentUserId]);

  const markAsRead = useCallback(async (messageIds: string[]) => {
    if (!messageIds.length || !currentUserId) return;
    try {
      const session = await createClient().auth.getSession();
      const token = session.data.session?.access_token;
      await fetch('/api/messages/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ messageIds }),
      });
    } catch (error) {
      console.error('Unable to mark messages as read', error);
    }
  }, [currentUserId]);

  const sendMessage = useCallback(async (content: string, orderId?: string) => {
    if (!currentUserId || !conversationId) throw new Error('Not authenticated or no conversation selected');
    const { data, error } = await createClient()
      .from('messages')
      .insert([{ sender_id: currentUserId, receiver_id: conversationId, content, order_id: orderId ?? null }])
      .select('*, sender:sender_id(id,full_name,avatar_url,role), receiver:receiver_id(id,full_name,avatar_url,role), order:order_id(id)')
      .single();
    if (error || !data) throw new Error(error?.message || 'Unable to send message');
    // Append the newly sent message locally so sender sees it immediately
    setMessages((current) => {
      if (!current) return [data];
      if (current.some(msg => msg.id === data.id)) return current;
      return [...current, data];
    });

    // Send notification to receiver
    try {
      const { data: sessionData } = await createClient().auth.getSession();
      const { data: senderProfile } = await createClient()
        .from('users')
        .select('full_name')
        .eq('id', currentUserId)
        .single();
      await fetch('/api/notifications/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({
          receiverId: conversationId,
          senderName: senderProfile?.full_name || 'Someone',
          content,
          senderId: currentUserId,
        }),
      });
    } catch (notifError) {
      console.error('Failed to send message notification:', notifError);
    }

    return data;
  }, [currentUserId, conversationId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation-${currentUserId}-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
      }, (payload) => {
        const newMessage = payload.new as MessageWithRelations;
        setMessages((current) => {
          if (current.some(msg => msg.id === newMessage.id)) return current;
          return [...current, newMessage];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
      }, (payload) => {
        const updated = payload.new as MessageWithRelations;
        setMessages((current) => current.map(msg => msg.id === updated.id ? updated : msg));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    const unreadIds = messages
      .filter(m => !m.is_read && m.receiver_id === currentUserId)
      .map(m => m.id);
    if (unreadIds.length > 0) markAsRead(unreadIds);
  }, [messages, currentUserId, markAsRead]);

  const orderId = messages.reduce<string | undefined>((curr, msg) => {
    if (!curr && msg.order_id) return msg.order_id;
    return curr;
  }, undefined);

  return {
    messages, loading, error,
    sendMessage: async (content: string, orderId?: string) => sendMessage(content, orderId),
    markAsRead, orderId, refresh: fetchMessages,
  };
}
