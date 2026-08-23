-- Least-privilege grants for the credentials database.
-- Applied after auth.sql when an owner connection can create role auth_app.
-- auth_app may SELECT/INSERT/UPDATE only — no DDL, no DELETE on users.

revoke all on schema auth from public;
revoke all on all tables in schema auth from public;

grant usage on schema auth to auth_app;
grant select, insert, update on table auth.users to auth_app;
grant select, insert, update on table auth.preferences to auth_app;

alter table auth.users enable row level security;
alter table auth.users force row level security;
alter table auth.preferences enable row level security;
alter table auth.preferences force row level security;

drop policy if exists auth_users_app_rw on auth.users;
drop policy if exists auth_prefs_app_rw on auth.preferences;

create policy auth_users_app_rw
  on auth.users
  for all
  to auth_app
  using (true)
  with check (true);

create policy auth_prefs_app_rw
  on auth.preferences
  for all
  to auth_app
  using (true)
  with check (true);
