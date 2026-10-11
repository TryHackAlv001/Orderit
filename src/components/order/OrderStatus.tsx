interface OrderStatusProps {
  status: string;
}

export function OrderStatus({ status }: OrderStatusProps) {
  return <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent-text">{status}</span>;
}
