interface OrderCardProps {
  orderNumber: string;
  status: string;
}

export function OrderCard({ orderNumber, status }: OrderCardProps) {
  return (
    <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-lg font-semibold">Order {orderNumber}</h3>
      <p className="mt-2 text-sm text-muted">Status: {status}</p>
    </article>
  );
}
