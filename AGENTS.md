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

### Tests / typecheck / lint
- Tests: `npm test` (runs `node --test scripts/lib/*.test.mjs`, 11 tests, no DB or
  network needed).
- UI typecheck: `npx tsc --noEmit -p market/tsconfig.json`.
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

### Installing root deps (non-obvious)
- The root `postinstall` (`scripts/patch-awal-pkg.mjs`) is **not idempotent**: it
  succeeds on a fresh `node_modules` but exits non-zero if `awal` is already
  patched. So the cloud update script installs root deps with
  `npm install --ignore-scripts` (the patch is a Windows-only Electron fix, not
  needed headless). If you need the patch locally on a clean tree, run a plain
  `npm install`. The market app is installed **with** scripts
  (`npm install --prefix market`) because esbuild needs its postinstall.
