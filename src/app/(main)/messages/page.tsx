'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useConversations, useMessages } from '@/hooks/useMessages';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { ConversationList } from '@/components/messaging/ConversationList';
import { ChatWindow } from '@/components/messaging/ChatWindow';

export default function MessagesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const { conversations, loading: conversationsLoading } = useConversations(user?.id);
  const { messages, loading: messagesLoading, sendMessage } = useMessages(activeConversationId, user?.id);
  const onlineUserIds = useOnlinePresence();
  const activeConversation = conversations.find(
    (conversation) => conversation.otherUserId === activeConversationId
  ) ?? null;

  // Handle ?with= parameter to auto-select conversation
  useEffect(() => {
    const withUserId = searchParams.get('with');
    if (withUserId) {
      setActiveConversationId(withUserId);
      if (isMobile) {
        setShowChat(true);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    if (isMobile) {
      setShowChat(true);
    }
  };

  const handleBackToList = () => {
    setShowChat(false);
  };

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Please log in to view messages.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bg">
      {/* Conversation List */}
      <div className={`${isMobile ? (showChat ? 'hidden' : 'w-full') : 'w-1/3'} border-r border-border`}>
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          loading={conversationsLoading}
          onSelect={handleSelectConversation}
          onlineUserIds={onlineUserIds}
        />
      </div>

      {/* Chat Window */}
      <div className={`${isMobile ? (showChat ? 'w-full' : 'hidden') : 'w-2/3'}`}>
        {activeConversationId ? (
          <ChatWindow
            conversationId={activeConversationId}
            messages={messages}
            loading={messagesLoading}
            onSendMessage={sendMessage}
            onBack={isMobile ? handleBackToList : undefined}
            currentUserId={user.id}
            conversation={activeConversation}
            isOtherUserOnline={onlineUserIds.has(activeConversationId)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-muted">Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}