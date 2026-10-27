export interface UserAddress {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  address_line: string;
  city: string;
  state: string;
  landmark: string | null;
  is_default: boolean;
  is_checkout_only: boolean;
  created_at: string;
}

export interface UserAddressDraft {
  full_name: string;
  phone: string;
  address_line: string;
  city: string;
  state: string;
  landmark: string;
}

export const USER_ADDRESS_LIMITS = {
  full_name: 100,
  phone: 14,
  address_line: 250,
  city: 100,
  state: 100,
  landmark: 150,
} as const;

const NIGERIAN_PHONE_PATTERN = /^(\+234|0)[789][01]\d{8}$/;

export function normalizeUserAddressDraft(draft: UserAddressDraft): UserAddressDraft {
  return {
    full_name: draft.full_name.trim(),
    phone: draft.phone.trim(),
    address_line: draft.address_line.trim(),
    city: draft.city.trim(),
    state: draft.state.trim(),
    landmark: draft.landmark.trim(),
  };
}

export function validateUserAddressDraft(draft: UserAddressDraft): string | null {
  const address = normalizeUserAddressDraft(draft);
  if (!address.full_name || !address.phone || !address.address_line || !address.city || !address.state) {
    return "Enter your full name, phone number, address, city, and state.";
  }
  if (address.full_name.length > USER_ADDRESS_LIMITS.full_name ||
      address.phone.length > USER_ADDRESS_LIMITS.phone ||
      address.address_line.length > USER_ADDRESS_LIMITS.address_line ||
      address.city.length > USER_ADDRESS_LIMITS.city ||
      address.state.length > USER_ADDRESS_LIMITS.state ||
      address.landmark.length > USER_ADDRESS_LIMITS.landmark) {
    return "One or more address fields are too long.";
  }
  if (!NIGERIAN_PHONE_PATTERN.test(address.phone)) {
    return "Enter a valid Nigerian phone number, such as +2348012345678 or 08012345678.";
  }
  return null;
}

export function formatUserAddress(address: Pick<UserAddress, "address_line" | "city" | "state" | "landmark">): string {
  return [address.address_line, address.landmark, address.city, address.state]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)
    .join(", ");
}
