import { ChevronRight } from "lucide-react";
import type { ConversationPreview } from "@/types";

interface ConversationListProps {
  conversations: ConversationPreview[];
  activeConversationId?: string | null;
  loading: boolean;
  onSelect: (conversationId: string) => void;
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ConversationList({ conversations, activeConversationId, loading, onSelect }: ConversationListProps) {
  return (
    <div className="h-full rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-6 flex items-center justify-between px-2">
        <div>
          <h3 className="text-lg font-semibold">Conversations</h3>
          <p className="text-sm text-slate-600">Select a conversation to begin chatting.</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 px-2">
          <div className="h-20 rounded-3xl bg-slate-100" />
          <div className="h-20 rounded-3xl bg-slate-100" />
          <div className="h-20 rounded-3xl bg-slate-100" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
          No conversations yet. Start a chat from an order or vendor page.
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((conversation) => (
            <button
              key={conversation.otherUserId}
              onClick={() => onSelect(conversation.otherUserId)}
              className={`flex w-full items-center justify-between gap-4 rounded-3xl border px-4 py-4 text-left transition hover:border-slate-300 ${
                activeConversationId === conversation.otherUserId
                  ? "border-slate-300 bg-slate-50"
                  : "border-transparent bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-700">
                  {conversation.avatarUrl ? (
                    <img src={conversation.avatarUrl} alt={conversation.displayName} className="h-12 w-12 rounded-2xl object-cover" />
                  ) : (
                    conversation.displayName
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{conversation.displayName}</p>
                    <span className="text-xs text-slate-500">{formatTime(conversation.lastMessageAt)}</span>
                  </div>
                  <p className="truncate text-sm text-slate-600">{conversation.lastMessage}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {conversation.unreadCount > 0 && (
                  <span className="rounded-full bg-blue-500 px-2.5 py-1 text-xs font-semibold text-white">
                    {conversation.unreadCount}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
