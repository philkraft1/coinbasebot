# Launch Ivory in the Base App

The Base App (after April 9, 2026) treats this repo as a **standard web app + wallet**. There is no MiniKit / `farcaster.json` path. Discovery is [Base.dev](https://www.base.dev).

Charts stay public. Username login still saves studies. **Connect wallet** uses
wagmi `injected` + `baseAccount` on Base so the Base in-app browser and regular
web users can attach a wallet. The configured Builder Code is appended to
eligible transactions outside the Base App; Base App adds attribution
automatically.

## Production host (Vercel)

[`vercel.json`](../vercel.json) builds the Vite UI (`market/dist`), rewrites `/coinbase-api/*` to `https://api.coinbase.com/*`, and falls back to `index.html` for `/`, `/spot`, and `/login`.

Vercel's Git integration creates a preview for feature branches and deploys
`main` to `https://coinbasebot.vercel.app`. Do not run a second CLI deployment
in CI. The `Base App` GitHub workflow validates every build and smoke-tests the
exact public URL reported by a successful production deployment. SSO-protected
preview deployments use the same artifact checks without attempting to bypass
Vercel authentication.

The current Base launch is static and does not expose `/api`; Home and Spot
remain public, while username signup/login is unavailable in production. If the
Fastify API is re-enabled later, set these **production** environment variables
and do not reuse Neon `DATABASE_URL` (that schema is only `wallet.events`).

| Variable | Required | Notes |
| --- | --- | --- |
| `AUTH_DATABASE_URL` | yes for signup/login | Encrypted RDS from [`infra/auth-rds.yaml`](../infra/auth-rds.yaml) (`auth_app` + `sslmode=verify-full`), **or** a dedicated Neon database created only for `auth.*` |
| `AUTH_SESSION_SECRET` | yes for signup/login | At least 32 random bytes. Serverless cannot persist `.data/session.secret` |
| `AUTH_ALLOWED_ORIGINS` | split-origin only | Comma-separated exact HTTPS origins; omit for same-origin production |
| `AUTH_COOKIE_SECURE` | recommended | Set `1`. Also implied when `VERCEL=1` |
| `AUTH_DATABASE_URL_OWNER` | migrate only | RDS master / Neon owner. Not needed at request time |
| `AUTH_DATABASE_SSL_CA` | RDS if needed | Path to Amazon `global-bundle.pem` |

Local/dev is unchanged: `npm run auth` (PGlite under `.data/auth`) and `npm run market`.

## Automated preflight

[`config/base-app.json`](../config/base-app.json) is the source of truth for the
Base app ID, production origin, listing copy, routes, and image dimensions.

```bash
npm run build --prefix market
npm run base:check
npm run base:check:prod
```

The static check fails if the built HTML, manifest, or image assets drift from
that configuration or if deployment security policy weakens. The production
check additionally verifies HTTPS response types, security headers, all public
assets, and the Home, Spot, and Login shells.

## Security layers

- Wallet connection requires an explicit Base Account or browser-wallet choice.
  Wallet telemetry and silent reconnect are disabled; provider errors are
  reduced to safe user-facing messages.
- The enforced CSP allows only Ivory, Coinbase's public market WebSocket, Base
  RPC/wallet hosts, and the Base Account handoff. `frame-ancestors 'none'`
  prevents clickjacking. COOP stays `same-origin-allow-popups` so the Base
  Account popup can communicate safely with its opener.
- Vercel only proxies the two public Coinbase market-product route shapes used
  by the UI. Mutating methods return 405. Hashed assets are immutable; HTML is
  revalidated.
- CI uses immutable Action commits, lockfile-only installs, no persisted Git
  credentials, full tests/typechecks/build checks, and moderate-or-higher npm
  audit gates. Dependabot monitors both npm projects and GitHub Actions.
- The dormant username API is excluded from the static production deployment.
  Before it is exposed, it requires a dedicated encrypted database and a
  32-byte-or-longer random session secret. Sessions are HttpOnly, Secure on
  HTTPS, SameSite Strict, issuer/audience bound, and expire after 24 hours.

Vercel's platform DDoS mitigation is automatic. After authenticating to the
project dashboard, stage WAF rules in **log-only** mode for `/coinbase-api/*`
(start around 120 requests/minute/IP) and future `/api/login` or `/api/signup`
routes (start around 10 requests/minute/IP). Review real traffic before
publishing a rate-limit or challenge action; never deploy a broad deny rule
without the staged log → preview → production process.

## Register on Base.dev (dashboard)

This step cannot be done from the repo. After the Vercel URL is live:

1. Open [https://www.base.dev](https://www.base.dev) and create a project.
2. Set **primary URL** to the production HTTPS origin (no trailing path), for example `https://coinbasebot.vercel.app`.
   The homepage `<head>` includes `<meta name="base:app_id" content="6a8a941d39d7d26f4bad1867" />` for Base.dev ownership verification.
3. Fill metadata:

| Field | Suggested value |
| --- | --- |
| Name | Ivory |
| Tagline | Live USD spot charts |
| Description | Watch live Coinbase USD spot markets, charts, trades, and order books. |
| Icon | `https://coinbasebot.vercel.app/icon-512.png` |
| Screenshots | Home (`/`) and Spot (`/spot`) on a phone |
| Category | Finance / Markets (pick the closest Base.dev category) |
| Builder code | `bc_ugqeenuu` |

4. Open that primary URL inside the Base App and share it.

Already-registered apps do not need to re-enter metadata unless the primary URL changes.

The public ERC-8021 suffix for `bc_ugqeenuu` is stored beside the project
metadata in [`config/base-app.json`](../config/base-app.json). The wallet client
applies this suffix globally, so future eligible transactions retain
attribution without per-call configuration.

## Out of scope

- MiniKit / `farcaster.json`
- Moving `wallet.events` off Neon
- On-chain trading or swaps in this launch
