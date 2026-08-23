-- Agentic Wallet event log (Neon / Postgres).
-- Applied by: node scripts/wallet-events.mjs migrate

create schema if not exists wallet;

create table if not exists wallet.events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  kind text not null,
  status text not null,
  email text,
  evm_address text,
  solana_address text,
  chain text,
  from_asset text,
  to_asset text,
  amount numeric,
  recipient text,
  tx_hash text,
  command text,
  error text,
  payload jsonb not null default '{}'::jsonb,
  constraint wallet_events_kind_check check (kind in (
    'auth_login',
    'auth_verify',
    'auth_logout',
    'status',
    'balance',
    'address',
    'show',
    'trade',
    'send',
    'fund',
    'x402_search',
    'x402_pay',
    'x402_details',
    'note',
    'other'
  )),
  constraint wallet_events_status_check check (status in ('started', 'succeeded', 'failed'))
);

create index if not exists wallet_events_occurred_at_idx on wallet.events (occurred_at desc);
create index if not exists wallet_events_kind_idx on wallet.events (kind);
create index if not exists wallet_events_email_idx on wallet.events (email);
create index if not exists wallet_events_tx_hash_idx on wallet.events (tx_hash) where tx_hash is not null;
