begin;

create or replace function public.vendor_order_buyer_profiles(p_buyer_ids uuid[])
returns table (buyer_id uuid, full_name text, email text, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct u.id, u.full_name, u.email, u.phone
  from public.users u
  where u.id = any(coalesce(p_buyer_ids, '{}'::uuid[]))
    and exists (
      select 1
      from public.orders o
      join public.users vendor on vendor.id = auth.uid() and vendor.role = 'vendor'
      where o.buyer_id = u.id
        and o.vendor_id = auth.uid()
    );
$$;

revoke all on function public.vendor_order_buyer_profiles(uuid[]) from public;
grant execute on function public.vendor_order_buyer_profiles(uuid[]) to authenticated;

notify pgrst, 'reload schema';

commit;
