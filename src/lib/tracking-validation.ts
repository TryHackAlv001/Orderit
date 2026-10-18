export function trackingNumberError(value: string): string | null {
  const trackingNumber = value.trim();
  if (!trackingNumber) return null;
  if (trackingNumber.length > 64) {
    return "Tracking numbers must be 64 characters or fewer.";
  }
  if (!/^[a-zA-Z0-9/-]+$/.test(trackingNumber)) {
    return "Use letters, numbers, dashes, or slashes only.";
  }
  return null;
}

function isPublicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost")) return false;

  if (/^[0-9.]+$/.test(host)) {
    const octets = host.split(".").map(Number);
    if (octets.length !== 4 || octets.some((octet) => octet < 0 || octet > 255)) return false;
    const [first, second, third] = octets;
    return !(
      first === 0
      || first === 10
      || first === 127
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || (first === 100 && second >= 64 && second <= 127)
      || (first === 192 && second === 0 && third === 0)
      || (first === 192 && second === 0 && third === 2)
      || (first === 198 && (second === 18 || second === 19))
      || (first === 198 && second === 51 && third === 100)
      || (first === 203 && second === 0 && third === 113)
      || first >= 224
    );
  }

  if (host.includes(":")) {
    const firstHextet = Number.parseInt(host.split(":")[0] || "0", 16);
    return firstHextet >= 0x2000
      && firstHextet <= 0x3fff
      && !host.startsWith("2001:db8:");
  }

  const reservedSuffixes = [
    ".arpa",
    ".example",
    ".home",
    ".home.arpa",
    ".internal",
    ".invalid",
    ".lan",
    ".local",
    ".onion",
    ".test",
  ];
  if (!host.includes(".") || reservedSuffixes.some((suffix) => host.endsWith(suffix))) return false;

  return host.split(".").every((label) =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
  );
}

export function trackingUrlError(value: string): string | null {
  const trackingUrl = value.trim();
  if (!trackingUrl) return null;
  if (!/^https:\/\//i.test(trackingUrl)) {
    return "Tracking links must start with https://.";
  }

  let url: URL;
  try {
    url = new URL(trackingUrl);
  } catch {
    return "Enter a valid tracking URL.";
  }
  if (url.protocol !== "https:") {
    return "Tracking links must start with https://.";
  }
  if (!isPublicHostname(url.hostname)) {
    return "Use a public tracking link, not a localhost or internal address.";
  }
  return null;
}
