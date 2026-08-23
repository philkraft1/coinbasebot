# Launch Ivory in the Base App

The Base App (after April 9, 2026) treats this repo as a **standard web app + wallet**. There is no MiniKit / `farcaster.json` path. Discovery is [Base.dev](https://www.base.dev).

Charts stay public. Username login still saves studies. Base Account / Connect wallet is omitted for now so Base.dev can load a plain web page.

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
| `AUTH_SESSION_SECRET` | yes for signup/login | Long random string. Serverless cannot persist `.data/session.secret` |
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
that configuration. The production check additionally verifies HTTPS response
types, all public assets, and the Home, Spot, and Login shells.

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
| Builder code | Your [builder code](https://docs.base.org/apps/builder-codes/builder-codes) |

4. Open that primary URL inside the Base App and share it.

Already-registered apps do not need to re-enter metadata unless the primary URL changes.

## Out of scope

- MiniKit / `farcaster.json`
- Moving `wallet.events` off Neon
- On-chain trading or swaps in this launch
