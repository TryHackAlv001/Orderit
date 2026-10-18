begin;

do $migration$
declare
  has_status boolean;
  has_to_status boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_status_history'
      and column_name = 'status'
  ) into has_status;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_status_history'
      and column_name = 'to_status'
  ) into has_to_status;

  if not has_to_status then
    if not has_status then
      raise exception 'order_status_history must contain status or to_status';
    end if;

    alter table public.order_status_history
      add column to_status text generated always as (status) stored;
  end if;
end
$migration$;

commit;
