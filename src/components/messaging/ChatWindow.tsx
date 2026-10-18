'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, Smile } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import {
  MessageOrderCard,
  MessageProductCard,
  OrderContextCard,
  ProductContextCard,
} from './MessageContextCard';
import type {
  ConversationPreview,
  MessageOrderContext,
  MessageProductContext,
  MessageProductSnapshot,
  MessageWithRelations,
} from '@/types';

interface ChatWindowProps {
  conversationId: string;
  messages: MessageWithRelations[];
  loading: boolean;
  onSendMessage: (
    content: string,
    options: { orderId: string | null; productId: string | null },
  ) => Promise<boolean>;
  onRetryMessage: (messageId: string) => Promise<void>;
  onMarkRead: () => Promise<void>;
  onBack?: () => void;
  currentUserId: string;
  conversation: ConversationPreview | null;
  isOtherUserOnline: boolean;
  isConversationVisible: boolean;
  composerProduct: MessageProductContext | null;
  composerOrder: MessageOrderContext | null;
  onClearProduct: () => void;
  onClearOrder: () => void;
}

export function ChatWindow({
  conversationId,
  messages,
  loading,
  onSendMessage,
  onRetryMessage,
  onMarkRead,
  onBack,
  currentUserId,
  conversation,
  isOtherUserOnline,
  isConversationVisible,
  composerProduct,
  composerOrder,
  onClearProduct,
  onClearOrder,
}: ChatWindowProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const previousLengthRef = useRef(0);
  const readTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const observedReadIds = useRef(new Set<string>());

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesContainerRef.current?.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior,
    });
    nearBottomRef.current = true;
    setShowNewMessages(false);
  };

  useEffect(() => {
    previousLengthRef.current = 0;
    nearBottomRef.current = true;
    setShowNewMessages(false);
    setMessage('');
  }, [conversationId]);

  useEffect(() => {
    if (loading) return;
    if (previousLengthRef.current === 0) {
      previousLengthRef.current = messages.length;
      if (messages.length > 0) requestAnimationFrame(() => scrollToBottom('instant'));
      return;
    }

    if (messages.length > previousLengthRef.current) {
      if (nearBottomRef.current) scrollToBottom();
      else setShowNewMessages(true);
    }
    previousLengthRef.current = messages.length;
  }, [loading, messages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !isConversationVisible) return;
    let conversationInViewport = false;

    const scheduleRead = () => {
      if (!conversationInViewport || readTimerRef.current || observedReadIds.current.size === 0) return;
      readTimerRef.current = setTimeout(() => {
        readTimerRef.current = undefined;
        if (
          !conversationInViewport
          || document.visibilityState !== 'visible'
          || !document.hasFocus()
          || !isConversationVisible
        ) return;
        void onMarkRead();
        observedReadIds.current.clear();
      }, 1000);
    };

    const observer = new IntersectionObserver((entries) => {
      if (
        !conversationInViewport
        || document.visibilityState !== 'visible'
        || !document.hasFocus()
      ) return;
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const messageId = (entry.target as HTMLElement).dataset.unreadMessageId;
        if (messageId) observedReadIds.current.add(messageId);
      });
      scheduleRead();
    }, { root: container, threshold: 0.65 });

    const observeVisibleMessages = () => {
      container.querySelectorAll<HTMLElement>('[data-unread-message-id]')
        .forEach((element) => observer.observe(element));
    };
    const viewportObserver = new IntersectionObserver((entries) => {
      conversationInViewport = entries.some(
        (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.25,
      );
      if (conversationInViewport) {
        observeVisibleMessages();
        scheduleRead();
      }
    }, { threshold: 0.25 });
    viewportObserver.observe(container);
    observeVisibleMessages();
    document.addEventListener('visibilitychange', observeVisibleMessages);

    return () => {
      observer.disconnect();
      viewportObserver.disconnect();
      document.removeEventListener('visibilitychange', observeVisibleMessages);
      if (readTimerRef.current) {
        clearTimeout(readTimerRef.current);
        readTimerRef.current = undefined;
      }
    };
  }, [isConversationVisible, messages, onMarkRead]);

  const handleSendMessage = async () => {
    if (!message.trim() || sending) return;

    setSending(true);
    const sent = await onSendMessage(message.trim(), {
      orderId: composerOrder?.id ?? null,
      productId: composerProduct?.id ?? null,
    });
    if (sent) {
      setMessage('');
      if (composerProduct) onClearProduct();
    }
    setSending(false);
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  const otherUser = messages.find((item) => item.sender_id !== currentUserId)?.sender
    ?? messages.find((item) => item.receiver_id !== currentUserId)?.receiver;
  const vendorProfile = Array.isArray(otherUser?.vendor_profiles)
    ? otherUser.vendor_profiles[0]
    : otherUser?.vendor_profiles;
  const displayName = conversation?.displayName
    || (otherUser?.role === 'vendor'
      ? vendorProfile?.shop_name || otherUser.full_name
      : otherUser?.full_name)
    || 'Unknown User';
  const avatarUrl = conversation?.avatarUrl
    || (otherUser?.role === 'vendor' ? vendorProfile?.logo_url : otherUser?.avatar_url);
  const role = conversation?.role || otherUser?.role;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-accent" />
          <p className="mt-2 text-muted">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex min-h-16 items-center justify-between border-b border-border p-3 sm:p-4">
        <div className="flex min-w-0 items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to conversations"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-raised md:hidden"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-raised">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-10 w-10 object-cover" />
              ) : (
                <span className="text-sm font-semibold text-muted" aria-hidden="true">
                  {displayName.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-text">{displayName}</h3>
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <span>{role === 'vendor' ? 'Vendor' : role === 'admin' ? 'Admin' : role === 'buyer' ? 'Buyer' : 'User'}</span>
                <span aria-hidden="true">·</span>
                <span
                  aria-label={isOtherUserOnline ? 'Online' : 'Offline'}
                  className={`h-2 w-2 rounded-full ${isOtherUserOnline ? 'bg-green-600' : 'bg-[#450011]'}`}
                />
                <span>{isOtherUserOnline ? 'Online' : 'Offline'}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={messagesContainerRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
          nearBottomRef.current = nearBottom;
          if (nearBottom) setShowNewMessages(false);
        }}
        className="relative flex-1 space-y-4 overflow-y-auto p-3 sm:p-4"
        role="log"
        aria-label={`Messages with ${displayName}`}
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-muted">
              No messages yet. Choose a product or order context to start the conversation.
            </p>
          </div>
        ) : messages.map((item) => {
          const outgoing = item.sender_id === currentUserId;
          const readTime = item.read_at
            ? new Date(item.read_at).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
            : null;
          const statusText = item.delivery_status === 'sending'
            ? 'Sending…'
            : item.delivery_status === 'failed'
              ? 'Failed'
              : item.is_read
                ? 'Read'
                : 'Sent';

          return (
            <div
              key={item.id}
              data-unread-message-id={
                !outgoing && !item.is_read ? item.id : undefined
              }
              className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`}
            >
              <div className="min-w-0 max-w-[85%] sm:max-w-xs lg:max-w-md">
                {item.order_context && (
                  <MessageOrderCard order={item.order_context} currentUserId={currentUserId} />
                )}
                <MessageProductCard
                  productId={item.product_id}
                  product={item.product_context ?? null}
                  snapshot={item.product_snapshot ?? null}
                />
                <MessageBubble text={item.content} incoming={!outgoing} />
                <div className={`mt-1 flex items-center gap-1 text-xs text-muted ${
                  outgoing ? 'justify-end' : 'justify-start'
                }`}>
                  <span>{new Date(item.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}</span>
                  {outgoing && (
                    item.delivery_status === 'failed' ? (
                      <>
                        <span aria-label={item.send_error ?? 'Message failed to send'}>{statusText}</span>
                        <button
                          type="button"
                          onClick={() => void onRetryMessage(item.id)}
                          className="min-h-11 rounded-md px-2 font-semibold text-accent-text underline"
                        >
                          Retry
                        </button>
                      </>
                    ) : (
                      <span
                        title={readTime ? `Read ${readTime}` : undefined}
                        aria-label={readTime ? `Read at ${readTime}` : statusText}
                      >
                        {statusText}{item.delivery_status === 'sending' ? '' : item.is_read ? ' ✓✓' : ' ✓'}
                        {readTime && <span className="sr-only"> at {readTime}</span>}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {showNewMessages && (
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className="sticky bottom-2 left-1/2 min-h-11 -translate-x-1/2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-on shadow"
          >
            New messages
          </button>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 border-t border-border p-3 pb-[calc(var(--safe-bottom)+0.75rem)] sm:p-4 md:pb-4">
        {(composerOrder || composerProduct) && (
          <div className="mb-2 flex flex-col gap-2">
            {composerOrder && (
              <OrderContextCard
                order={composerOrder}
                currentUserId={currentUserId}
                removable
                onRemove={onClearOrder}
              />
            )}
            {composerProduct && (
              <ProductContextCard
                productId={composerProduct.id}
                product={composerProduct}
                snapshot={null}
                removable
                onRemove={onClearProduct}
              />
            )}
          </div>
        )}
        <div className="flex items-end gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, 2000))}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              aria-label="Message"
              maxLength={2000}
              className="min-h-11 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-text focus:border-accent focus:outline-none"
              rows={1}
              style={{ maxHeight: '120px' }}
              onInput={(event) => {
                const target = event.currentTarget;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />
          </div>
          <button
            type="button"
            aria-label="Emoji picker unavailable"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted"
            disabled
          >
            <Smile className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void handleSendMessage()}
            disabled={!message.trim() || sending}
            aria-label={sending ? 'Sending message' : 'Send message'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-on hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
