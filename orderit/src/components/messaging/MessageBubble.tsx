interface MessageBubbleProps {
  text: string;
  incoming?: boolean;
  timestamp?: string;
  isRead?: boolean;
}

export function MessageBubble({ text, incoming = false, timestamp, isRead }: MessageBubbleProps) {
  return (
    <div className={`rounded-3xl px-4 py-3 max-w-xs lg:max-w-md ${
      incoming ? "bg-gray-100 text-gray-900" : "bg-blue-500 text-white ml-auto"
    }`}>
      {text}
    </div>
  );
}
