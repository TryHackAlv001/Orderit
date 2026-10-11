/**
 * Order Status Helper Functions
 * Provides consistent status labels and colors across the application
 */

export const statusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    preparing: "Preparing",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
    shipped: "Shipped",
  };
  return labels[status] ?? status;
};

export const statusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: "bg-warning/10 text-text",
    confirmed: "bg-accent/10 text-accent-text",
    preparing: "bg-warning/10 text-text",
    out_for_delivery: "bg-accent/10 text-accent-text",
    delivered: "bg-success/10 text-text",
    cancelled: "bg-danger/10 text-danger-text",
    shipped: "bg-accent/10 text-accent-text",
  };
  return colors[status] ?? "bg-surface-raised text-text";
};

export const statusIcon = (status: string) => {
  switch (status) {
    case "pending":
      return "⏳";
    case "confirmed":
      return "✓";
    case "preparing":
      return "👨‍🍳";
    case "out_for_delivery":
      return "🚗";
    case "shipped":
      return "📦";
    case "delivered":
      return "✓✓";
    case "cancelled":
      return "✗";
    default:
      return "•";
  }
};
