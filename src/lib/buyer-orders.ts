export const IN_PROGRESS_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "shipped",
  "out_for_delivery",
] as const;

export function isBuyerOrderInProgress(status: string): boolean {
  return IN_PROGRESS_ORDER_STATUSES.some((inProgressStatus) => inProgressStatus === status);
}
