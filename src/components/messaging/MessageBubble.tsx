interface MessageBubbleProps {
  text: string;
  incoming?: boolean;
}

export function MessageBubble({ text, incoming = false }: MessageBubbleProps) {
  return (
    <div className={`rounded-lg px-4 py-3 max-w-xs lg:max-w-md ${
      incoming ? "bg-surface-raised text-text" : "border border-accent/20 bg-accent/10 text-text ml-auto"
    }`}>
      <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{text}</p>
    </div>
  );
}
