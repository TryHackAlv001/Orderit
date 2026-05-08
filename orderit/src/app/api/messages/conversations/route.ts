import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminClient } from '@/lib/supabase-admin';
import type { ConversationPreview } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdminClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const currentUserId = user.id;

    // Get all conversations for the current user
    const { data: messages, error: messagesError } = await supabaseAdminClient
      .from('messages')
      .select(`
        id,
        content,
        created_at,
        is_read,
        sender_id,
        receiver_id,
        order_id,
        sender:users!messages_sender_id_fkey(
          id,
          full_name,
          avatar_url,
          role,
          vendor_profiles(user_id, shop_name, logo_url)
        ),
        receiver:users!messages_receiver_id_fkey(
          id,
          full_name,
          avatar_url,
          role,
          vendor_profiles(user_id, shop_name, logo_url)
        )
      `)
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }

    // Group messages by conversation
    const conversationMap = new Map<string, any>();

    messages?.forEach((message: any) => {
      const otherUserId = message.sender_id === currentUserId ? message.receiver_id : message.sender_id;
      const otherUser = message.sender_id === currentUserId ? message.receiver : message.sender;

      if (!conversationMap.has(otherUserId)) {
        const displayName = otherUser?.role === 'vendor'
          ? (otherUser.vendor_profiles?.[0]?.shop_name || otherUser.full_name || 'Unknown Vendor')
          : (otherUser?.full_name || 'Unknown User');

        const avatarUrl = otherUser?.role === 'vendor'
          ? otherUser.vendor_profiles?.[0]?.logo_url
          : otherUser?.avatar_url;

        conversationMap.set(otherUserId, {
          otherUserId,
          displayName,
          avatarUrl,
          lastMessage: message.content,
          lastMessageAt: message.created_at,
          unreadCount: 0,
          orderId: message.order_id,
          role: otherUser?.role || 'buyer',
        });
      }

      // Count unread messages
      if (message.receiver_id === currentUserId && !message.is_read) {
        conversationMap.get(otherUserId).unreadCount++;
      }

      // Update last message if this is more recent
      if (new Date(message.created_at) > new Date(conversationMap.get(otherUserId).lastMessageAt)) {
        conversationMap.get(otherUserId).lastMessage = message.content;
        conversationMap.get(otherUserId).lastMessageAt = message.created_at;
        conversationMap.get(otherUserId).orderId = message.order_id;
      }
    });

    const conversations: ConversationPreview[] = Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Error in conversations API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}