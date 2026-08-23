# Coinbase Agentic Wallet (coinbasebot)

Public repo: [https://github.com/philkraft1/coinbasebot](https://github.com/philkraft1/coinbasebot)

This repo wires a Coinbase **Agentic Wallet** into Cursor and Claude Code so an agent can hold USDC, swap on Base, and pay for [x402](https://docs.cdp.coinbase.com/x402/welcome) APIs.

No Coinbase API keys or seed phrases. You sign in with email, set spending limits, and the agent operates inside those limits.

## Transfer to `Desktop\coinbasebot`

Your working directory on this PC is `C:\Users\phsok\Desktop\coinbasebot`.

This cloud agent cannot write there. On **your Windows PC**, in **PowerShell**, run:

```powershell
cd $env:USERPROFILE\Desktop\coinbasebot
Set-ExecutionPolicy -Scope Process Bypass
irm https://raw.githubusercontent.com/philkraft1/coinbasebot/main/scripts/install-on-desktop.ps1 | iex
```

That clones this repo into that folder, installs Payments MCP + Agentic Wallet skills, and **merges** `payments-mcp` into your existing Claude Desktop and Cursor configs (your other MCP servers stay). Details: [DESKTOP.md](DESKTOP.md).

If install stops on `bundle.js` missing: close Claude Desktop and Cursor, then run [scripts/repair-payments-mcp.ps1](scripts/repair-payments-mcp.ps1). The Coinbase installer deletes a partial download after a network drop.

Then sign in and set limits. On Windows do **not** run bare `npx awal` (`spawn EINVAL`). Use:

```bat
npm install
node scripts\run-awal.mjs auth login kraftcoding@gmail.com
node scripts\run-awal.mjs auth verify YOUR_CODE
node scripts\run-awal.mjs show
```

Set **max per call $1** and **max per session $5**. Fully quit Claude Desktop and Cursor. Open `C:\Users\phsok\Desktop\coinbasebot` as the workspace.

The wallet already holds **~12 USDC + 0.0004 ETH on Base**. Do not start an unattended trading loop. Claude Desktop alone cannot swap.

## Advanced Trade WebSocket

This is **exchange market data** on `wss://advanced-trade-ws.coinbase.com`. It is not the Agentic Wallet (`npx awal`). The Vite UI stays on public channels. `user` and `futures_balance_summary` need a **Coinbase CDP API key** for the Coinbase.com Advanced Trade account — see [.env.example](.env.example). Do not send `"jwt": "exampleJWT"` or `"XYZ"`.

Always pair every other channel with `heartbeats`. Sparse books otherwise close after 60–90s. The heartbeats subscribe is `{ "type": "subscribe", "channel": "heartbeats" }` only — no `product_ids`. Same shape for `futures_balance_summary`. `user` may omit `product_ids` (all products). One user connection per account; changing products means unsubscribe and reconnect.

Public channels reject most `-USDC` product IDs. The exceptions are `USDT-USDC` and `EURC-USDC`.

| Channel | Auth | In the Vite UI | Notes |
| --- | --- | --- | --- |
| `heartbeats` | no | yes | Always paired. Watch `heartbeat_counter` for gaps. |
| `ticker` | no | yes | Price, 24h change, best bid/ask |
| `ticker_batch` | no | no | CLI only |
| `level2` | no | yes | Inbound frames use channel `l2_data`. A connection-wide `sequence_num` gap resubscribes. |
| `market_trades` | no | yes | Prints |
| `candles` | no | yes | Latest bars, rolled into 5-minute OHLC |
| `status` | no | yes | Product online / trading disabled |
| `user` | CDP JWT | no | First batch of fewer than 50 orders completes the open-order snapshot |
| `futures_balance_summary` | CDP JWT | no | No `product_ids` |

```bash
npm run market          # public feed UI at http://127.0.0.1:43147
npm run level2          # ETH-USD / ETH-EUR top of book in the terminal
npm run ws              # default: level2 + heartbeats, pretty-printed
```

```bash
copy .env.example .env   # then put your real key name + EC private key in .env
npm run ws -- --channel ticker --products BTC-USD
npm run ws -- --channels ticker,level2,market_trades --products ETH-USD,ETH-EUR
npm run ws -- --channel candles --products ETH-USD
npm run ws -- --channel status --products ETH-USD,ETH-EUR
npm run ws -- --channel user
npm run ws -- --channel futures_balance_summary
npm run ws -- --log feed.jsonl
```

`scripts/coinbase-ws.mjs` signs a **fresh JWT** on every subscribe/unsubscribe when `.env` has a real CDP key. It never writes `Output1.txt` unless you pass `--log`. Public channels work with no key.

## Coinbase.com vs this wallet

They are **not the same account**.

| | Coinbase.com app / exchange | Agentic Wallet (this project) |
| --- | --- | --- |
| Where it lives | Your Coinbase login | Embedded wallet tied to an email (here: `kraftcoding@gmail.com`) |
| How you see it | Coinbase app | `npx awal show` or “Show me my wallet” |
| Trading | Coinbase Advanced Trade | `npx awal trade` on **Base** only |
| Balance you funded | Stays $0 unless you withdraw there | USDC sent to the Base receive address |

**Base (EVM) receive address:** `0xD10d7eA8B847110f3bbf71781ABefbac01517b82`

**Solana receive address:** `HCCQTfNtw7dUCB84VCtpEbkAuztLH3B1eUC5Kd9v3Raf`

If Coinbase.com shows $0, check this wallet instead (`npm run wallet:balance`).

## What each client can do

| Client | How it connects | Pay for APIs (x402) | Swap / trade tokens |
| --- | --- | --- | --- |
| Claude Desktop | Payments MCP only | Yes | No |
| Claude Code / Cursor | MCP **plus** [`.claude/skills/agentic-wallet`](.claude/skills/agentic-wallet) | Yes | Yes (`npx awal trade`) |

Trading is **Base mainnet only**. Example: `npx awal trade 1 usdc eth`.

Do **not** turn on an unattended looping strategy. First live action is a **$1 USDC → ETH** smoke test.

## Prerequisites

- Node.js 22 or newer (`node -v`)
- npm
- Claude Code (for swaps) and/or Cursor
- Claude Desktop only if you want x402 payments in the Desktop app

## Install on Windows (Claude Code)

Run these on the PC where Claude Code is installed. Use **Windows PowerShell** for the MCP installer (Claude Desktop/Code are Windows apps). Origin CLI clone can stay in WSL.

```powershell
# From this repo
npx @coinbase/payments-mcp --client claude-code --auto-config
npx skills add coinbase/agentic-wallet-skills --agent claude-code -y

npx awal auth login kraftcoding@gmail.com
npx awal auth verify <6-digit-code>
npx awal show
```

In the wallet UI, set spending limits **before** Claude trades:

- **Max per call:** `$1`
- **Max per session:** `$5`

Claude cannot raise these. Restart Claude Code after install.

### Smoke-test prompts

```
What's my wallet balance?
```

```
Swap $1 USDC for ETH on Base
```

If the swap is over your per-call cap, it is blocked. If the balance is 0, you funded Coinbase.com or the wrong chain.

## Claude Desktop (x402 only, no swaps)

In **Windows PowerShell** (not this Linux cloud VM, not WSL):

```powershell
npx @coinbase/payments-mcp --client claude --auto-config
```

If auto-config does not write the file, edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "payments-mcp": {
      "command": "node",
      "args": ["%USERPROFILE%\\.payments-mcp\\bundle.js"]
    }
  }
}
```

If `%USERPROFILE%` does not expand in your Claude build, use the absolute path, for example `C:\\Users\\YOUR_WINDOWS_USERNAME\\.payments-mcp\\bundle.js`.

Do not paste Linux paths (`/home/ubuntu/...`) into Claude on Windows. Fully quit and reopen Claude Desktop, then ask: **Show me my wallet**.

## Cursor (this repo)

[`.cursor/mcp.json`](.cursor/mcp.json) starts Payments MCP via [`scripts/run-payments-mcp.mjs`](scripts/run-payments-mcp.mjs) and the remote [Neon MCP](https://mcp.neon.tech/mcp) (`npx add-mcp https://mcp.neon.tech/mcp`). Claude Code reads the same Neon entry from [`.mcp.json`](.mcp.json). Neon uses OAuth the first time you connect — no API key is committed. MCP still cannot swap; Cursor uses the skill + `awal` for trades.

```bash
npm run mcp:install
npm run wallet:status
npm run wallet:balance
npm run wallet:show
```

## First-time funding

1. `npm run wallet:show` (or “Show me my wallet”).
2. Sign in with email OTP (`kraftcoding@gmail.com` for the funded wallet).
3. **Fund** (Coinbase Onramp) or **Receive** and send **USDC on Base** to the EVM address above.
4. Set max per call `$1` and max per session `$5`.

## npm scripts

```bash
npm run mcp:install      # install Payments MCP into ~/.payments-mcp
npm run mcp:status
npm run skills:install   # refresh .claude/skills/agentic-wallet
npm run wallet:status
npm run wallet:balance
npm run wallet:show
npm run db:migrate        # create wallet.events on Neon (needs DATABASE_URL)
npm run events            # recent wallet events
```

## Wallet events (Neon)

Agentic Wallet actions are logged to Neon Postgres — not Coinbase.com fills. Copy `.env.example` to `.env` and set `DATABASE_URL`. Never commit the real URL.

```bash
npm run db:migrate
node scripts/run-awal.mjs balance
npm run events
npm run events -- --kind trade
```

`scripts/run-awal.mjs` writes one row after each command (`trade`, `send`, `balance`, `auth_login`, …). OTP codes from `auth verify` are not stored. If Neon is unreachable the wallet command still runs.

## Commands

```bash
npx @coinbase/payments-mcp
npx @coinbase/payments-mcp --client claude-code --auto-config
npx awal status
npx awal balance
npx awal trade 1 usdc eth
npx awal x402 bazaar search "crypto news"
```

## Troubleshooting

- **Coinbase app shows $0** — Funds are in the Agentic Wallet on Base, not the exchange.
- **Claude Desktop cannot swap** — Install Claude Code and the agentic-wallet skill.
- **MCP tools missing** — Confirm `~/.payments-mcp/bundle.js` (or `%USERPROFILE%\.payments-mcp\bundle.js`) exists, then restart the client.
- **Wallet UI never opens** — The companion app is Electron; you need a desktop session. Run `npm run wallet:show`.
- **OTP expired** — `npx awal auth login kraftcoding@gmail.com` and use the newest email code.
- **Git push 403 to Origin** — This cloud agent token cannot create or write Origin repos (`repository_access_denied`). Workarounds:
  1. Download `coinbasebot.bundle` or `coinbasebot-working-tree.zip` from the agent artifacts, then on your PC: `bash scripts/import-bundle.sh coinbasebot.bundle` and `bash scripts/push-from-your-pc.sh` after `origin auth login`.
  2. Or create a GitHub repo from your PC: `npm run publish:github` (needs `gh auth login`).
  3. Cursor on Windows: copy [config/cursor.mcp.windows.json](config/cursor.mcp.windows.json) over `%USERPROFILE%\.cursor\mcp.json` (uses `C:\Users\phsok\.payments-mcp\bundle.js`).

Official docs: [Agentic Wallet CLI](https://docs.cdp.coinbase.com/agentic-wallet/cli/quickstart), [MCP quickstart](https://docs.cdp.coinbase.com/agentic-wallet/mcp/quickstart), [trade skill](https://docs.cdp.coinbase.com/agentic-wallet/cli/skills/trade).

## Repositories

**GitHub (public, use this):** [philkraft1/coinbasebot](https://github.com/philkraft1/coinbasebot)

```bash
git clone https://github.com/philkraft1/coinbasebot.git
```

Downloads: [artifacts-v1 release](https://github.com/philkraft1/coinbasebot/releases/tag/artifacts-v1) (`coinbasebot.bundle`, `coinbasebot-working-tree.zip`).

**Origin (Cursor):** [ivorycrowncollective/coinbasebot](https://cursor.com/codebase/ivorycrowncollective/coinbasebot) — this cloud agent cannot push there (403). To sync from your PC after `origin auth login`: `bash scripts/push-from-your-pc.sh`.
