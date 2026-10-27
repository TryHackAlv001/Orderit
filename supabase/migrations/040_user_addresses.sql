begin;

create table if not exists public.user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 100),
  phone text not null check (phone ~ $ua_phone_pattern$^(\+234|0)[789][01]\d{8}$ua_phone_pattern$),
  address_line text not null check (char_length(btrim(address_line)) between 1 and 250),
  city text not null check (char_length(btrim(city)) between 1 and 100),
  state text not null check (char_length(btrim(state)) between 1 and 100),
  landmark text check (landmark is null or char_length(btrim(landmark)) <= 150),
  is_default boolean not null default false,
  is_checkout_only boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists user_addresses_user_created_idx
  on public.user_addresses (user_id, created_at, id)
  where is_checkout_only = false;

create unique index if not exists user_addresses_one_default_per_user_uidx
  on public.user_addresses (user_id)
  where is_default = true and is_checkout_only = false;

create unique index if not exists user_addresses_one_checkout_only_per_user_uidx
  on public.user_addresses (user_id)
  where is_checkout_only = true;

alter table public.user_addresses enable row level security;
revoke all on public.user_addresses from public, anon, authenticated;
grant select, insert, update, delete on public.user_addresses to authenticated;
grant all on public.user_addresses to service_role;

drop policy if exists user_addresses_owner_access on public.user_addresses;
create policy user_addresses_owner_access
  on public.user_addresses for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.enforce_user_address_rules()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $ua_rules$
declare
  saved_address_count integer;
begin
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'Address ownership cannot be changed'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and new.is_checkout_only is distinct from old.is_checkout_only then
    raise exception 'Checkout-only address status cannot be changed'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  if new.is_checkout_only then
    new.is_default := false;
    if not exists (
      select 1
      from public.user_addresses
      where user_id = new.user_id
        and is_checkout_only = true
        and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) then
      return new;
    end if;

    raise exception 'A checkout address is already in progress'
      using errcode = '23505';
  end if;

  select count(*) into saved_address_count
  from public.user_addresses
  where user_id = new.user_id
    and is_checkout_only = false
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if saved_address_count >= 5 then
    raise exception 'You can save up to five addresses'
      using errcode = '23514';
  end if;

  if pg_trigger_depth() = 1 then
    if new.is_default or not exists (
      select 1
      from public.user_addresses
      where user_id = new.user_id
        and is_default = true
        and is_checkout_only = false
        and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) then
      update public.user_addresses
      set is_default = false
      where user_id = new.user_id
        and is_default = true
        and is_checkout_only = false
        and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
      new.is_default := true;
    end if;
  end if;

  return new;
end;
$ua_rules$;

create or replace function public.promote_oldest_user_address()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $ua_promote$
begin
  if old.is_default and not old.is_checkout_only then
    perform pg_advisory_xact_lock(hashtextextended(old.user_id::text, 0));

    if not exists (
      select 1
      from public.user_addresses
      where user_id = old.user_id
        and is_default = true
        and is_checkout_only = false
    ) then
      update public.user_addresses
      set is_default = true
      where id = (
        select id
        from public.user_addresses
        where user_id = old.user_id
          and is_checkout_only = false
        order by created_at asc, id asc
        limit 1
      );
    end if;
  end if;

  return old;
end;
$ua_promote$;

drop trigger if exists user_addresses_enforce_rules on public.user_addresses;
create trigger user_addresses_enforce_rules
  before insert or update on public.user_addresses
  for each row execute function public.enforce_user_address_rules();

drop trigger if exists user_addresses_promote_oldest on public.user_addresses;
create trigger user_addresses_promote_oldest
  after delete on public.user_addresses
  for each row execute function public.promote_oldest_user_address();

commit;
