-- Supabase schema for OrderIt multi-vendor e-commerce platform

-- Enable pgcrypto for UUID generation
create extension if not exists "pgcrypto";

-- Helper functions for role checks
create or replace function public.is_admin() returns boolean stable language sql as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.is_vendor() returns boolean stable language sql as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'vendor'
  );
$$;

create or replace function public.is_buyer() returns boolean stable language sql as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'buyer'
  );
$$;

-- users table
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  phone text,
  role text not null default 'buyer' check (role in ('buyer', 'vendor', 'admin')),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- vendor profiles table
create table if not exists public.vendor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  shop_name text not null,
  shop_description text,
  logo_url text,
  banner_url text,
  location text,
  is_verified boolean not null default false,
  rating numeric(3,2) not null default 0,
  total_sales bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id)
);

-- categories table
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text,
  parent_id uuid references public.categories(id) on delete set null
);

-- products table
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(12,2) not null,
  compare_price numeric(12,2),
  images text[] not null default '{}',
  stock_quantity int not null default 0,
  sku text unique,
  is_active boolean not null default true,
  rating numeric(3,2) not null default 0,
  review_count int not null default 0,
  created_at timestamptz not null default now()
);

-- orders table
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.users(id) on delete cascade,
  vendor_id uuid not null references public.users(id) on delete cascade,
  status text not null check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  subtotal numeric(12,2) not null,
  delivery_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  payment_method text not null,
  payment_reference text,
  payment_status text not null,
  delivery_address jsonb,
  created_at timestamptz not null default now()
);

-- order_items table
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete set null,
  quantity int not null default 1,
  price_at_purchase numeric(12,2) not null,
  product_name text not null,
  product_image text
);

-- reviews table
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id uuid not null references public.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users(id) on delete cascade,
  receiver_id uuid not null references public.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  content text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- notifications table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  body text not null,
  type text,
  is_read boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security on all tables
alter table public.users enable row level security;
alter table public.vendor_profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.reviews enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

-- Users policies
create policy "Users can select their own profile" on public.users for select using (auth.uid() = id or public.is_admin());
create policy "Users can update their own profile" on public.users for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Admins can manage users" on public.users for all using (public.is_admin());

-- Vendor profile policies
create policy "Vendors can view own profile" on public.vendor_profiles for select using (auth.uid() = user_id or public.is_admin());
create policy "Vendors can manage own profile" on public.vendor_profiles for update using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create policy "Admins can manage vendor profiles" on public.vendor_profiles for all using (public.is_admin());

-- Categories policies
create policy "Public can view categories" on public.categories for select using (true);
create policy "Admins can manage categories" on public.categories for all using (public.is_admin());

-- Products policies
create policy "Public can view active products" on public.products for select using (is_active = true);
create policy "Vendor can manage own products" on public.products for select using (auth.uid() = vendor_id or public.is_admin()) with check (auth.uid() = vendor_id or public.is_admin());
create policy "Vendor can insert own products" on public.products for insert using (auth.uid() = vendor_id or public.is_admin()) with check (auth.uid() = vendor_id or public.is_admin());
create policy "Vendor can update own products" on public.products for update using (auth.uid() = vendor_id or public.is_admin()) with check (auth.uid() = vendor_id or public.is_admin());
create policy "Admins can manage products" on public.products for all using (public.is_admin());

-- Orders policies
create policy "Buyer can view own orders" on public.orders for select using (auth.uid() = buyer_id or auth.uid() = vendor_id or public.is_admin());
create policy "Buyer can insert own orders" on public.orders for insert using (auth.uid() = buyer_id or public.is_admin()) with check (auth.uid() = buyer_id or public.is_admin());
create policy "Buyer can update own orders" on public.orders for update using (auth.uid() = buyer_id or auth.uid() = vendor_id or public.is_admin()) with check (auth.uid() = buyer_id or auth.uid() = vendor_id or public.is_admin());
create policy "Admins can manage orders" on public.orders for all using (public.is_admin());

-- Order items policies
create policy "Order participants can view order items" on public.order_items for select using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and (auth.uid() = o.buyer_id or auth.uid() = o.vendor_id or public.is_admin())
  )
);
create policy "Admins can manage order items" on public.order_items for all using (public.is_admin());

-- Reviews policies
create policy "Public can view reviews" on public.reviews for select using (true);
create policy "Buyers can insert own reviews" on public.reviews for insert using (auth.uid() = buyer_id or public.is_admin()) with check (auth.uid() = buyer_id or public.is_admin());
create policy "Buyers can update own reviews" on public.reviews for update using (auth.uid() = buyer_id or public.is_admin()) with check (auth.uid() = buyer_id or public.is_admin());
create policy "Admins can manage reviews" on public.reviews for all using (public.is_admin());

-- Messages policies
create policy "Message participants can view messages" on public.messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id or public.is_admin());
create policy "Sender can insert message" on public.messages for insert using (auth.uid() = sender_id or public.is_admin()) with check (auth.uid() = sender_id or public.is_admin());
create policy "Participants can update own messages" on public.messages for update using (auth.uid() = sender_id or public.is_admin()) with check (auth.uid() = sender_id or public.is_admin());
create policy "Admins can manage messages" on public.messages for delete using (public.is_admin());

-- Notifications policies
create policy "Users can view own notifications" on public.notifications for select using (auth.uid() = user_id or public.is_admin());
create policy "Users can insert own notifications" on public.notifications for insert using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create policy "Users can update own notifications" on public.notifications for update using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create policy "Admins can manage notifications" on public.notifications for all using (public.is_admin());

-- Indexes for frequent queries
create index if not exists idx_users_role on public.users(role);
create index if not exists idx_vendor_profiles_user_id on public.vendor_profiles(user_id);
create index if not exists idx_vendor_profiles_shop_name on public.vendor_profiles(shop_name);
create index if not exists idx_vendor_profiles_location on public.vendor_profiles(location);
create index if not exists idx_categories_parent_id on public.categories(parent_id);
create index if not exists idx_products_vendor_id on public.products(vendor_id);
create index if not exists idx_products_category_id on public.products(category_id);
create index if not exists idx_products_is_active on public.products(is_active);
create index if not exists idx_products_created_at on public.products(created_at);
create index if not exists idx_orders_buyer_id on public.orders(buyer_id);
create index if not exists idx_orders_vendor_id on public.orders(vendor_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_created_at on public.orders(created_at);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_product_id on public.order_items(product_id);
create index if not exists idx_reviews_product_id on public.reviews(product_id);
create index if not exists idx_reviews_buyer_id on public.reviews(buyer_id);
create index if not exists idx_messages_sender_id on public.messages(sender_id);
create index if not exists idx_messages_receiver_id on public.messages(receiver_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_is_read on public.notifications(is_read);
create index if not exists idx_notifications_created_at on public.notifications(created_at);

-- Enable realtime for messages table
alter publication supabase_realtime add table public.messages;
