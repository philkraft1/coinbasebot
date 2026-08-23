-- Username accounts + saved chart prefs.
-- Production store: encrypted AWS RDS (see infra/auth-rds.yaml) or a dedicated
-- Neon database created only for auth.*. Do not reuse Neon DATABASE_URL (wallet.events).
-- Apply with:
--   AUTH_DATABASE_URL=... npm run auth:migrate
-- PGlite (local/dev without RDS) runs this file only — skip auth-security.sql.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  constraint users_username_len check (char_length(username) between 3 and 32),
  constraint users_username_fmt check (username ~ '^[A-Za-z0-9_]+$')
);

create unique index if not exists users_username_lower on auth.users (lower(username));

create table if not exists auth.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  chart jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
