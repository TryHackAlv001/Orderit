export function toKobo(value: number | string): number | null {
  const amount = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) return null;

  const [naira, fraction = ""] = amount.split(".");
  const kobo = Number(naira) * 100 + Number((fraction + "00").slice(0, 2));
  return Number.isSafeInteger(kobo) ? kobo : null;
}