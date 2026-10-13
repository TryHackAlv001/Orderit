begin;

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  personalization_enabled boolean not null default true,
  notify_orders boolean not null default true,
  notify_delivery boolean not null default true,
  notify_promotions boolean not null default false,
  notify_messages boolean not nusll default true,
  updated_at timestamptz default now()
);

alter table public.user_preferences enable row level security;
grant select, insert, update on public.user_preferences to authenticated;

create policy "Users can read own preferences"
  on public.user_preferences for select using (user_id = auth.uid());
create policy "Users can insert own preferences"
  on public.user_preferences for insert with check (user_id = auth.uid());
create policy "Users can update own preferences"
  on public.user_preferences for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;
