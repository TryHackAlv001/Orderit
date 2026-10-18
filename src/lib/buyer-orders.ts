const IN_PROGRESS_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "shipped",
  "out_for_delivery",
] as const;

export function getBuyerInProgressOrderStatuses(): readonly string[] {
  return IN_PROGRESS_ORDER_STATUSES;
}

export function isBuyerOrderInProgress(status: string): boolean {
  return getBuyerInProgressOrderStatuses().some((inProgressStatus) => inProgressStatus === status);
}

export function countBuyerOrdersInProgress(
  orders: readonly { status: string }[],
): number {
  return orders.filter((order) => isBuyerOrderInProgress(order.status)).length;
}
