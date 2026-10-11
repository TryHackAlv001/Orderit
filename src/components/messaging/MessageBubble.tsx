interface MessageBubbleProps {
  text: string;
  incoming?: boolean;
  timestamp?: string;
  isRead?: boolean;
}

export function MessageBubble({ text, incoming = false, timestamp, isRead }: MessageBubbleProps) {
  return (
    <div className={`rounded-lg px-4 py-3 max-w-xs lg:max-w-md ${
      incoming ? "bg-surface-raised text-text" : "border border-accent/20 bg-accent/10 text-text ml-auto"
    }`}>
      {text}
    </div>
  );
}
