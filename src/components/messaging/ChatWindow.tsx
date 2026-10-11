'use client';

import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Smile } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import type { ConversationPreview, MessageWithRelations } from '@/types';

interface ChatWindowProps {
  conversationId: string;
  messages: MessageWithRelations[];
  loading: boolean;
  onSendMessage: (content: string, orderId?: string) => Promise<any>;
  onBack?: () => void;
  currentUserId: string;
  conversation: ConversationPreview | null;
  isOtherUserOnline: boolean;
}

export function ChatWindow({
  conversationId,
  messages,
  loading,
  onSendMessage,
  onBack,
  currentUserId,
  conversation,
  isOtherUserOnline,
}: ChatWindowProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      await onSendMessage(message.trim());
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get conversation info
  const otherUser = messages.find(m => m.sender_id !== currentUserId)?.sender ||
                   messages.find(m => m.receiver_id !== currentUserId)?.receiver;
  const vendorProfile = Array.isArray(otherUser?.vendor_profiles)
    ? otherUser.vendor_profiles[0]
    : otherUser?.vendor_profiles;
  const displayName = conversation?.displayName ||
    (otherUser?.role === 'vendor'
      ? vendorProfile?.shop_name || otherUser.full_name
      : otherUser?.full_name) ||
    'Unknown User';
  const avatarUrl = conversation?.avatarUrl ||
    (otherUser?.role === 'vendor' ? vendorProfile?.logo_url : otherUser?.avatar_url);
  const role = conversation?.role || otherUser?.role;

  const orderId = messages.find(m => m.order_id)?.order_id;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
          <p className="mt-2 text-muted">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="rounded-full p-2 hover:bg-surface-raised md:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-surface-raised flex items-center justify-center">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold text-muted">
                  {displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-text">{displayName}</h3>
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <span>{role === 'vendor' ? 'Vendor' : role === 'admin' ? 'Admin' : role === 'buyer' ? 'Buyer' : 'User'}</span>
                <span aria-hidden="true">•</span>
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

      {/* Order Banner */}
      {orderId && (
        <div className="bg-accent/10 border-b border-accent p-3">
          <p className="text-sm text-accent-text">
            This conversation is about Order #{orderId.slice(0, 8)}
          </p>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-muted">No messages yet. Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
            >
              <div className="max-w-xs lg:max-w-md">
                <MessageBubble
                  text={msg.content}
                  incoming={msg.sender_id !== currentUserId}
                />
                <div className={`flex items-center gap-1 mt-1 text-xs text-muted ${
                  msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'
                }`}>
                  <span>{new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</span>
                  {msg.sender_id === currentUserId && (
                    <span>{msg.is_read ? '✓✓' : '✓'}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="border-t border-border p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="w-full resize-none rounded-lg border border-border px-3 py-2 focus:border-accent focus:outline-none"
              rows={1}
              style={{ minHeight: '40px', maxHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
          </div>
          <button
            className="rounded-full p-2 text-muted hover:text-muted"
            // Emoji picker would go here
          >
            <Smile className="h-5 w-5" />
          </button>
          <button
            onClick={handleSendMessage}
            disabled={!message.trim() || sending}
            className="rounded-full bg-accent p-2 text-accent-on hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
