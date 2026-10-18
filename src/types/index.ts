export interface User {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  role: "buyer" | "vendor" | "admin";
  avatar_url?: string;
  created_at: Date;
}

export interface VendorProfile {
  id: string;
  user_id: string;
  shop_name: string;
  shop_description?: string;
  logo_url?: string;
  banner_url?: string;
  location?: string;
  is_verified: boolean;
  rating: number;
  total_sales: number;
  created_at: Date;
}

export type AuthProfile = User | VendorProfile;

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  parent_id?: string;
}

export interface Product {
  id: string;
  vendor_id: string;
  category_id?: string;
  category?: { id?: string; name: string; slug?: string };
  name: string;
  description?: string;
  price: number;
  brand?: string;
  brand_normalized?: string;
  is_complete?: boolean;
  size_type?: "none" | "single" | "multi" | null;
  available_sizes?: string[];
  compare_price?: number;
  minimum_order: number;
  tags: string[];
  images: string[];
  stock_quantity: number;
  sku?: string;
  is_active: boolean;
  rating: number;
  review_count: number;
  created_at: Date;
  preparation_time?: number;
  is_available_today?: boolean;
  dietary_tags?: string[];
  spice_level?: string;
}

export interface ProductVariant {
  id: string;
  product_id?: string;
  color: string | null;
  size: string | null;
  stock_quantity: number;
}

export interface ProductAttributeRule {
  category_id: string;
  requires_color: boolean;
  requires_size: boolean;
}

export interface StockLog {
  id: string;
  product_id: string;
  previous_qty: number;
  new_qty: number;
  changed_by: string;
  changed_at: Date;
}

export interface Order {
  id: string;
  buyer_id: string;
  vendor_id: string;
  status: "pending" | "confirmed" | "preparing" | "out_for_delivery" | "shipped" | "delivered" | "cancelled";
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: string;
  payment_reference?: string;
  payment_status: string;
  delivery_address?: Record<string, unknown>;
  created_at: Date;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price_at_purchase: number;
  product_name: string;
  product_image?: string;
  selected_size?: string | null;
}

export interface Review {
  id: string;
  product_id: string;
  buyer_id: string;
  rating: number;
  comment?: string;
  created_at: Date;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  order_id: string | null;
  product_id: string | null;
  product_snapshot: MessageProductSnapshot | null;
  content: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  delivery_status?: "sending" | "failed";
  send_error?: string;
  product_context?: MessageProductContext | null;
  order_context?: MessageOrderContext | null;
}

export interface MessageProductSnapshot {
  product_id: string;
  name: string;
  image_url: string | null;
  price_kobo: number;
  captured_at: string;
}

export interface MessageProductContext {
  id: string;
  name: string;
  images: string[];
  price: number | null;
  is_active: boolean;
}

export interface MessageOrderContext {
  id: string;
  status: string;
  buyer_id: string;
  vendor_id: string;
  first_item: {
    product_id: string | null;
    product_name: string;
    product_image: string | null;
  } | null;
}

export interface MessageWithRelations extends Message {
  sender?: User & {
    vendor_profiles?: {
      shop_name?: string;
      logo_url?: string;
    }[] | {
      shop_name?: string;
      logo_url?: string;
    } | null;
  };
  receiver?: User & {
    vendor_profiles?: {
      shop_name?: string;
      logo_url?: string;
    }[] | {
      shop_name?: string;
      logo_url?: string;
    } | null;
  };
  order?: {
    id: string;
  };
}

export interface ConversationPreview {
  otherUserId: string;
  displayName: string;
  avatarUrl?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  orderId?: string;
  role: "buyer" | "vendor" | "admin";
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type?: string;
  is_read: boolean;
  link?: string;
  created_at: string;
}

export interface CartItem {
  id: string;
  database_id?: string;
  product: Product;
  quantity: number;
  variant_id?: string | null;
  needs_selection?: boolean;
  active_variant_count_at_add?: number;
  price_at_add?: number;
  selected_size?: string | null;
  selected_color?: string | null;
  synced_user_id?: string | null;
  vendor: {
    id: string;
    shop_name: string;
  };
}
