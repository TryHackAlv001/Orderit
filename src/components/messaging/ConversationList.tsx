import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { MessageCircle } from "lucide-react";
import type { ConversationPreview } from "@/types";

interface ConversationListProps {
  conversations: ConversationPreview[];
  activeConversationId?: string | null;
  loading: boolean;
  onSelect: (conversationId: string) => void;
  onlineUserIds: ReadonlySet<string>;
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`;

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

function truncateMessage(message: string, maxLength: number = 50): string {
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength) + '...';
}

export function ConversationList({
  conversations,
  activeConversationId,
  loading,
  onSelect,
  onlineUserIds,
}: ConversationListProps) {
  return (
    <div className="h-full rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="mb-6 flex items-center justify-between px-2">
        <div>
          <h3 className="text-lg font-semibold">Conversations</h3>
          <p className="text-sm text-muted">Select a conversation to begin chatting.</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 px-2">
          <div className="h-20 rounded-lg bg-surface-raised" />
          <div className="h-20 rounded-lg bg-surface-raised" />
          <div className="h-20 rounded-lg bg-surface-raised" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg p-6 text-center text-muted">
          No conversations yet. Start a chat from an order or vendor page.
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((conversation) => (
            <button
              key={conversation.otherUserId}
              onClick={() => onSelect(conversation.otherUserId)}
              className={`flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-4 text-left transition hover:border-border ${
                activeConversationId === conversation.otherUserId
                  ? "border-border bg-bg"
                  : "border-transparent bg-surface"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-raised text-sm font-semibold text-text">
                  <div className="relative">
                  {conversation.avatarUrl ? (
                    <div className="relative h-12 w-12 overflow-hidden rounded-lg">
                      <Image
                        src={conversation.avatarUrl}
                        alt={conversation.displayName}
                        fill
                        unoptimized
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    conversation.displayName
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                  )}
                    <div
                      aria-label={onlineUserIds.has(conversation.otherUserId) ? 'Online' : 'Offline'}
                      title={onlineUserIds.has(conversation.otherUserId) ? 'Online' : 'Offline'}
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-border ${
                        onlineUserIds.has(conversation.otherUserId) ? 'bg-green-600' : 'bg-[#450011]'
                      }`}
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-text">{conversation.displayName}</p>
                    <span className="flex-shrink-0 text-xs text-muted">{formatTime(conversation.lastMessageAt)}</span>
                  </div>
                  <p className="truncate text-sm text-muted">{truncateMessage(conversation.lastMessage)}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {conversation.unreadCount > 0 && (
                  <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-on">
                    {conversation.unreadCount}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
