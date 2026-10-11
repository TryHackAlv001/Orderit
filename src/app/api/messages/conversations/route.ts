import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminClient } from '@/lib/supabase-admin';
import type { ConversationPreview } from '@/types';

function getVendorProfile(user: any) {
  const profiles = user?.vendor_profiles;
  return Array.isArray(profiles) ? profiles[0] : profiles;
}

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
    const partnersToFetch = new Set<string>();

    // First pass: identify all unique partners
    messages?.forEach((message: any) => {
      const otherUserId = message.sender_id === currentUserId ? message.receiver_id : message.sender_id;
      partnersToFetch.add(otherUserId);
    });

    // Fetch all partner information
    const partnerInfo = new Map<string, any>();
    if (partnersToFetch.size > 0) {
      // Get partner user data
      const { data: partners, error: partnersError } = await supabaseAdminClient
        .from('users')
        .select('id, full_name, avatar_url, role, vendor_profiles(user_id, shop_name, logo_url)')
        .in('id', Array.from(partnersToFetch));

      if (partnersError) {
        console.error('Error fetching conversation partners:', partnersError);
        return NextResponse.json({ error: 'Failed to fetch conversation partners' }, { status: 500 });
      }

      partners?.forEach((partner: any) => {
        partnerInfo.set(partner.id, partner);
      });
    }

    messages?.forEach((message: any) => {
      const otherUserId = message.sender_id === currentUserId ? message.receiver_id : message.sender_id;
      const otherUser = partnerInfo.get(otherUserId) || (message.sender_id === currentUserId ? message.receiver : message.sender);

      if (!conversationMap.has(otherUserId)) {
        const vendorProfile = getVendorProfile(otherUser);
        const displayName = otherUser?.role === 'vendor'
          ? (vendorProfile?.shop_name || otherUser?.full_name || 'Unknown Vendor')
          : (otherUser?.full_name || 'Unknown User');

        const avatarUrl = otherUser?.role === 'vendor'
          ? vendorProfile?.logo_url
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