-- Least-privilege + RLS for wallet.events.
-- Applied by: node scripts/wallet-events.mjs migrate (after wallet-events.sql).
-- Requires role wallet_app (created by the migrate script). Does not store passwords.

revoke all on schema wallet from public;
revoke all on table wallet.events from public;

grant usage on schema wallet to wallet_app;
grant select, insert on table wallet.events to wallet_app;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant usage on schema wallet to authenticated';
    execute 'grant select, insert on table wallet.events to authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anonymous') then
    execute 'revoke all on schema wallet from anonymous';
    execute 'revoke all on table wallet.events from anonymous';
  end if;
end
$$;

alter table wallet.events enable row level security;
alter table wallet.events force row level security;

drop policy if exists wallet_events_app_select on wallet.events;
drop policy if exists wallet_events_app_insert on wallet.events;
drop policy if exists wallet_events_authenticated_select on wallet.events;
drop policy if exists wallet_events_authenticated_insert on wallet.events;
drop policy if exists wallet_events_owner_all on wallet.events;

create policy wallet_events_app_select
  on wallet.events
  for select
  to wallet_app
  using (true);

create policy wallet_events_app_insert
  on wallet.events
  for insert
  to wallet_app
  with check (true);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute $p$
      create policy wallet_events_authenticated_select
        on wallet.events
        for select
        to authenticated
        using (true)
    $p$;
    execute $p$
      create policy wallet_events_authenticated_insert
        on wallet.events
        for insert
        to authenticated
        with check (true)
    $p$;
  end if;
end
$$;

create policy wallet_events_owner_all
  on wallet.events
  for all
  to neondb_owner
  using (true)
  with check (true);
