# AGENTS.md

## Cursor Cloud specific instructions

This repo wires the Coinbase Agentic Wallet + a live market-data dashboard into
Cursor/Claude. Standard commands live in `README.md` and `package.json` scripts;
below are only the non-obvious caveats for running it in a headless cloud VM.

### What runs headless in the cloud (no credentials needed)
- **Market dashboard (primary app):** `npm run market` serves a Vite + React UI at
  `http://127.0.0.1:43147`. The browser opens a WebSocket to Coinbase's **public**
  Advanced Trade feed (`wss://advanced-trade-ws.coinbase.com`) and renders live
  tickers, level2 order books, trades, candles, and a heartbeat counter. Status
  goes `connecting` → `live` once data arrives. No API keys required.
- **CLI feeds:** `npm run ws` (and `npm run level2`) stream the same public
  channels to the terminal. No keys required.
- Both require network egress to Coinbase. Egress is unrestricted in this
  environment; if a future environment restricts egress, allow
  `advanced-trade-ws.coinbase.com`.
- Vite uses `strictPort` on `43147` — it will fail to start if that port is taken
  rather than picking another one.
- **Username accounts:** `npm run auth` listens on `127.0.0.1:43148`. The Vite
  app proxies `/api` there. Login/signup and saved studies do nothing useful
  unless this process is running. Omit `AUTH_DATABASE_URL` to use on-disk PGlite
  at `.data/auth` (same `sql/auth.sql` schema). Do **not** point this at Neon
  `DATABASE_URL` — that database is only `wallet.events`. Encrypted RDS is
  provisioned from `infra/auth-rds.yaml` when AWS credentials are available.

### Tests / typecheck / lint
- Tests: `npm test` (root scripts, `market/src/*.test.ts`, and `server/**/*.test.ts`).
  Auth API tests use ephemeral PGlite; they do not need AWS or Neon.
- UI typecheck: `npx tsc --noEmit -p market/tsconfig.json`.
- Auth API typecheck: `npx tsc --noEmit -p server/tsconfig.json`.
- There is **no ESLint/Prettier config** in this repo; "lint" is effectively the
  TypeScript typecheck above.

### Requires secrets — not runnable without them
- **Neon Postgres event log** (`npm run db:migrate`, `npm run events`,
  `npm run events:record`) needs `DATABASE_URL` (and `DATABASE_URL_UNPOOLED` for
  migrate) in `.env` (see `.env.example`). Without these the commands throw
  immediately. Not needed for the market UI or tests.
- **Private WS channels** (`--channel user`, `--channel futures_balance_summary`)
  need a Coinbase CDP API key (`COINBASE_API_KEY_NAME` +
  `COINBASE_API_PRIVATE_KEY`). Public channels work without them.

### Out of scope for headless cloud
- The `awal` Agentic Wallet CLI and the `scripts/run-awal.mjs` /
  `scripts/start-wallet.mjs` / `scripts/*-windows*` wrappers target a **Windows
  Electron desktop wallet** and require interactive email + OTP login plus a
  ~100MB Electron download. They cannot be exercised in a headless cloud VM. The
  root `postinstall` (`scripts/patch-awal-pkg.mjs`) only patches a local file and
  does not download Electron.

### Cloud Agent install script
The committed install script is in `.cursor/environment.json`. It is the
source of truth for future Cloud Agents on this revision (it wins over a
dashboard-saved personal/team environment).

### Installing root deps (non-obvious)
- The root `postinstall` (`scripts/patch-awal-pkg.mjs`) is **not idempotent**: it
  succeeds on a fresh `node_modules` but exits non-zero if `awal` is already
  patched. So the cloud update script installs root deps with
  `npm install --ignore-scripts` (the patch is a Windows-only Electron fix, not
  needed headless). If you need the patch locally on a clean tree, run a plain
  `npm install`. The market app is installed **with** scripts
  (`npm install --prefix market`) because esbuild needs its postinstall.
