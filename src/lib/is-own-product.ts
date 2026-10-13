export function isOwnProduct(
  productVendorId: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  return Boolean(productVendorId && userId && productVendorId === userId);
}
