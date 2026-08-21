# Coinbase Payments MCP

This repo wires [Coinbase Payments MCP](https://github.com/coinbase/payments-mcp) into Cursor so an agent can use an embedded wallet, onramp USDC, and pay for [x402](https://docs.cdp.coinbase.com/x402/welcome) services on Base, Polygon, and Solana.

No API keys or seed phrases. You sign in with email, set spending limits, and the agent pays for APIs from that wallet.

## Prerequisites

- Node.js 22 or newer (`node -v`)
- npm
- Cursor (or another stdio MCP client)

## Install

From this repo:

```bash
npx @coinbase/payments-mcp
```

The installer downloads the MCP server and companion wallet app into `~/.payments-mcp` (currently **2.12.1**).

If the installer asks which client to configure, choose **Other** (Cursor). You can skip prompts with:

```bash
npx @coinbase/payments-mcp install --client other --no-auto-config
```

Or use the npm scripts in this repo:

```bash
npm run mcp:install
npm run mcp:status
```

Then restart Cursor so it loads `.cursor/mcp.json`.

### What this repo adds

| File | Purpose |
| --- | --- |
| `.cursor/mcp.json` | Points Cursor at the Payments MCP server |
| `scripts/run-payments-mcp.mjs` | Starts `~/.payments-mcp/bundle.js`, with a clear error if it is not installed |

Manual equivalent (any MCP client):

```json
{
  "mcpServers": {
    "payments-mcp": {
      "command": "node",
      "args": ["/YOUR/HOME/.payments-mcp/bundle.js"]
    }
  }
}
```

Replace the path with the **Install Path** printed by `npx @coinbase/payments-mcp status`.

## First-time wallet setup

In Cursor Agent chat, ask:

```
Show me my wallet
```

That opens the companion wallet UI:

1. Enter your email and complete the OTP.
2. A new user gets an embedded wallet; a returning user is signed back in.
3. Click **Fund** and use Coinbase Onramp, or **Receive** and send USDC to the address.
4. Open the spending-limit tracker and set:
   - **Max per call** (for example `$0.05`)
   - **Max per session** (for example `$5.00`)

Only you can change those limits, transfer funds, or onramp. The agent can pay for x402 services within the limits you set.

## What to ask the agent

```
What's my wallet balance?
```

```
What x402 services are available for crypto data?
```

```
Get the latest crypto and AI news
```

```
What are the trending crypto tokens and what's the latest news about them?
```

Behind those prompts the agent uses:

**Wallet**

- Wallet address
- Token balances
- Sign-in status
- Open the wallet / Bazaar UI

**Payments**

- List x402 Bazaar services
- Fetch a service’s docs and price
- Check payment requirements without paying
- Call a paid API and settle in USDC

Search the Bazaar from the terminal as well:

```bash
npx awal x402 bazaar search "crypto news"
npx awal x402 bazaar list --network solana
```

## Other clients

The same install works with Claude Desktop, Claude Code, Codex CLI, and Gemini CLI:

```bash
npx @coinbase/payments-mcp --client claude --auto-config
npx @coinbase/payments-mcp --client claude-code --auto-config
npx @coinbase/payments-mcp --client codex --auto-config
npx @coinbase/payments-mcp --client gemini --auto-config
```

## Commands

```bash
npx @coinbase/payments-mcp              # install (default)
npx @coinbase/payments-mcp status       # check version and path
npx @coinbase/payments-mcp install --force
npx @coinbase/payments-mcp install --verbose
npx @coinbase/payments-mcp uninstall
```

## Troubleshooting

- **MCP tools missing in Cursor** — Confirm `~/.payments-mcp/bundle.js` exists, then fully restart Cursor.
- **Wallet UI never opens** — Ask “Show me my wallet” again. The server is an Electron app; a desktop session is required.
- **Installer says Payments MCP is running** — Close other MCP clients and retry, or choose Continue anyway if you are sure it is a false positive.
- **Permission or “command not found”** — Confirm `node` and `npm` are on your PATH (`node -v`, `npm -v`).

Official docs: [Agentic Wallet MCP quickstart](https://docs.cdp.coinbase.com/agentic-wallet/mcp/quickstart).
