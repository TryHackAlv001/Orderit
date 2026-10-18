export const ORDER_STATUS_LABELS: Readonly<Record<string, string>> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Packing",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  placed: "Placed",
};

export const ORDER_TRACKING_STEPS = [
  { key: "placed", label: "Order placed" },
  { key: "confirmed", label: "Payment confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
] as const;
