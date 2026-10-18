'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useConversations, useMessages } from '@/hooks/useMessages';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { ConversationList } from '@/components/messaging/ConversationList';
import { ChatWindow } from '@/components/messaging/ChatWindow';
import { createClient } from '@/lib/supabase/client';
import type {
  ConversationPreview,
  MessageOrderContext,
  MessageProductContext,
} from '@/types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PartnerResponse {
  partner: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    role: 'buyer' | 'vendor' | 'admin';
    vendor_profiles?: {
      user_id: string;
      shop_name: string;
      logo_url: string | null;
    }[] | {
      user_id: string;
      shop_name: string;
      logo_url: string | null;
    } | null;
  } | null;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [partner, setPartner] = useState<PartnerResponse['partner']>(null);
  const [composerProduct, setComposerProduct] = useState<MessageProductContext | null>(null);
  const [composerOrder, setComposerOrder] = useState<MessageOrderContext | null>(null);

  const { conversations, loading: conversationsLoading } = useConversations(user?.id);
  const {
    messages,
    loading: messagesLoading,
    sendMessage,
    retryMessage,
    markAsRead,
  } = useMessages(activeConversationId, user?.id);
  const onlineUserIds = useOnlinePresence();

  const rawTargetId = searchParams.get('to')
    ?? searchParams.get('with')
    ?? searchParams.get('conversation');
  const targetId = rawTargetId && UUID_PATTERN.test(rawTargetId) ? rawTargetId : null;
  const rawProductId = searchParams.get('product');
  const productId = rawProductId && UUID_PATTERN.test(rawProductId) ? rawProductId : null;
  const rawOrderId = searchParams.get('order');
  const orderId = rawOrderId && UUID_PATTERN.test(rawOrderId) ? rawOrderId : null;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!user || !targetId) return;
    let cancelled = false;
    setActiveConversationId(targetId);
    if (window.innerWidth < 768) setShowChat(true);
    setPartner(null);
    setComposerProduct(null);
    setComposerOrder(null);

    const loadContext = async () => {
      const supabase = createClient();
      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data.session?.access_token;
      if (sessionResult.error) {
        console.error('Unable to read messaging session:', sessionResult.error.message);
        return;
      }
      if (!token) return;

      const partnerQuery = new URLSearchParams({ to: targetId });
      if (productId) partnerQuery.set('product', productId);
      if (orderId) partnerQuery.set('order', orderId);
      const partnerRequest = fetch(`/api/messages/partner?${partnerQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      const productRequest = productId
        ? supabase
          .from('products')
          .select('id,name,images,price,is_active,vendor_id')
          .eq('id', productId)
          .eq('vendor_id', targetId)
          .eq('is_active', true)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const orderRequest = orderId
        ? supabase
          .from('orders')
          .select('id,status,buyer_id,vendor_id')
          .eq('id', orderId)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      try {
        const [partnerResponse, productResult, orderResult] = await Promise.all([
          partnerRequest,
          productRequest,
          orderRequest,
        ]);
        if (!partnerResponse.ok) {
          throw new Error('Unable to load conversation partner');
        }
        const partnerData = await partnerResponse.json() as PartnerResponse;
        if (cancelled) return;
        setPartner(partnerData.partner);

        if (productResult.error) {
          console.error('Unable to validate product context:', productResult.error.message);
        } else if (productResult.data) {
          setComposerProduct({
            id: productResult.data.id,
            name: productResult.data.name,
            images: productResult.data.images ?? [],
            price: productResult.data.price,
            is_active: productResult.data.is_active,
          });
        }

        const order = orderResult.data;
        if (orderResult.error) {
          console.error('Unable to validate order context:', orderResult.error.message);
        } else if (
          order
          && (order.buyer_id === user.id || order.vendor_id === user.id)
          && (order.buyer_id === targetId || order.vendor_id === targetId)
        ) {
          const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select('id,product_id,product_name,product_image')
            .eq('order_id', order.id)
            .order('id', { ascending: true })
            .limit(1);
          if (cancelled) return;
          if (itemsError) {
            console.error('Unable to load order context item:', itemsError.message);
          }
          setComposerOrder({
            id: order.id,
            status: order.status,
            buyer_id: order.buyer_id,
            vendor_id: order.vendor_id,
            first_item: items?.[0] ? {
              product_id: items[0].product_id,
              product_name: items[0].product_name,
              product_image: items[0].product_image,
            } : null,
          });
        }
      } catch (contextError) {
        if (!cancelled) {
          console.error('Unable to load messaging context:', contextError);
        }
      }
    };

    void loadContext();
    return () => {
      cancelled = true;
    };
  }, [orderId, productId, targetId, user]);

  const selectedConversation = conversations.find(
    (conversation) => conversation.otherUserId === activeConversationId,
  );
  const partnerProfile = Array.isArray(partner?.vendor_profiles)
    ? partner.vendor_profiles[0]
    : partner?.vendor_profiles;
  const partnerConversation: ConversationPreview | null = partner && partner.id === activeConversationId
    ? {
      otherUserId: partner.id,
      displayName: partner.role === 'vendor'
        ? partnerProfile?.shop_name || partner.full_name || 'Vendor'
        : partner.full_name || 'User',
      avatarUrl: partner.role === 'vendor'
        ? partnerProfile?.logo_url ?? undefined
        : partner.avatar_url ?? undefined,
      lastMessage: '',
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
      role: partner.role,
    }
    : null;
  const activeConversation = selectedConversation ?? partnerConversation;

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setPartner(null);
    setComposerProduct(null);
    setComposerOrder(null);
    if (isMobile) setShowChat(true);
  };

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Please log in to view messages.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100svh-var(--bottom-nav-height)-var(--safe-bottom))] min-h-0 bg-bg md:h-[calc(100svh-8rem)]">
      <div className={`${isMobile ? (showChat ? 'hidden' : 'w-full') : 'w-1/3'} min-h-0 border-r border-border`}>
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          loading={conversationsLoading}
          onSelect={handleSelectConversation}
          onlineUserIds={onlineUserIds}
        />
      </div>

      <div className={`${isMobile ? (showChat ? 'w-full' : 'hidden') : 'w-2/3'} min-h-0`}>
        {activeConversationId ? (
          <ChatWindow
            key={activeConversationId}
            conversationId={activeConversationId}
            messages={messages}
            loading={messagesLoading}
            onSendMessage={sendMessage}
            onRetryMessage={retryMessage}
            onMarkRead={markAsRead}
            onBack={isMobile ? () => setShowChat(false) : undefined}
            currentUserId={user.id}
            conversation={activeConversation}
            isOtherUserOnline={onlineUserIds.has(activeConversationId)}
            isConversationVisible={!isMobile || showChat}
            composerProduct={composerProduct}
            composerOrder={composerOrder}
            onClearProduct={() => setComposerProduct(null)}
            onClearOrder={() => setComposerOrder(null)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-muted">Select a conversation to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
