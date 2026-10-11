drop policy if exists "Public can view vendor profiles" on public.vendor_profiles;
create policy "Public can view vendor profiles"
  on public.vendor_profiles
  for select
  using (true);
