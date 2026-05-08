'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useConversations, useMessages } from '@/hooks/useMessages';
import { ConversationList } from '@/components/messaging/ConversationList';
import { ChatWindow } from '@/components/messaging/ChatWindow';

export default function MessagesPage() {
  const { user } = useAuth();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const { conversations, loading: conversationsLoading } = useConversations(user?.id);
  const { messages, loading: messagesLoading, sendMessage } = useMessages(activeConversationId, user?.id);

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
    <div className="flex h-screen bg-gray-50">
      {/* Conversation List */}
      <div className={`${isMobile ? (showChat ? 'hidden' : 'w-full') : 'w-1/3'} border-r border-gray-200`}>
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          loading={conversationsLoading}
          onSelect={handleSelectConversation}
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
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-gray-500">Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}