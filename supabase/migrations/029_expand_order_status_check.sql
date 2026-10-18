begin;

do $orders_status_check_029$
declare
  target_definition text :=
    'CHECK (status = ANY (ARRAY[''pending''::text, ''confirmed''::text, ''preparing''::text, ''shipped''::text, ''out_for_delivery''::text, ''delivered''::text, ''cancelled''::text]))';
  current_definition text;
  current_validated boolean;
  candidate_definition text;
begin
  select pg_get_constraintdef(c.oid, true), c.convalidated
    into current_definition, current_validated
  from pg_constraint as c
  where c.conrelid = 'public.orders'::regclass
    and c.conname = 'orders_status_check';

  if current_definition is distinct from target_definition
     or not coalesce(current_validated, false) then
    select pg_get_constraintdef(c.oid, true)
      into candidate_definition
    from pg_constraint as c
    where c.conrelid = 'public.orders'::regclass
      and c.conname = 'orders_status_check_029_new';

    if candidate_definition is distinct from target_definition then
      if candidate_definition is not null then
        alter table public.orders
          drop constraint orders_status_check_029_new;
      end if;

      alter table public.orders
        add constraint orders_status_check_029_new
        check (
          status in (
            'pending',
            'confirmed',
            'preparing',
            'shipped',
            'out_for_delivery',
            'delivered',
            'cancelled'
          )
        ) not valid;
    end if;

    alter table public.orders
      validate constraint orders_status_check_029_new;

    alter table public.orders
      drop constraint if exists orders_status_check;

    alter table public.orders
      rename constraint orders_status_check_029_new to orders_status_check;
  end if;
end
$orders_status_check_029$;

commit;
