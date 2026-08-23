# Launch Coinbasebot in the Base App

The Base App (after April 9, 2026) treats this repo as a **standard web app + wallet**. There is no MiniKit / `farcaster.json` path. Discovery is [Base.dev](https://www.base.dev).

Charts stay public. Username login still saves studies. **Connect wallet** uses wagmi `injected` + `baseAccount` so the Base in-app browser can attach a Base Account.

## Production host (Vercel)

[`vercel.json`](../vercel.json) builds the Vite UI (`market/dist`), rewrites `/coinbase-api/*` to `https://api.coinbase.com/*`, routes `/api/*` to the Fastify wrapper in [`api/index.ts`](../api/index.ts), and falls back to `index.html` for `/`, `/spot`, and `/login`.

```bash
npx vercel --prod
```

Set these **production** environment variables (Vercel dashboard or `vercel env add`). Do **not** reuse Neon `DATABASE_URL` (that schema is only `wallet.events`).

| Variable | Required | Notes |
| --- | --- | --- |
| `AUTH_DATABASE_URL` | yes for signup/login | Encrypted RDS from [`infra/auth-rds.yaml`](../infra/auth-rds.yaml) (`auth_app` + `sslmode=verify-full`), **or** a dedicated Neon database created only for `auth.*` |
| `AUTH_SESSION_SECRET` | yes for signup/login | Long random string. Serverless cannot persist `.data/session.secret` |
| `AUTH_COOKIE_SECURE` | recommended | Set `1`. Also implied when `VERCEL=1` |
| `AUTH_DATABASE_URL_OWNER` | migrate only | RDS master / Neon owner. Not needed at request time |
| `AUTH_DATABASE_SSL_CA` | RDS if needed | Path to Amazon `global-bundle.pem` |

Without `AUTH_DATABASE_URL` on Vercel, `/api/health` still returns 200 (`store: "unavailable"`) and Home/Spot still load. Signup/login return **503**.

Local/dev is unchanged: `npm run auth` (PGlite under `.data/auth`) and `npm run market`.

## Register on Base.dev (dashboard)

This step cannot be done from the repo. After the Vercel URL is live:

1. Open [https://www.base.dev](https://www.base.dev) and create a project.
2. Set **primary URL** to the production HTTPS origin (no trailing path), for example `https://coinbasebot.vercel.app`.
3. Fill metadata:

| Field | Suggested value |
| --- | --- |
| Name | Coinbasebot |
| Tagline | Live USD spot charts |
| Description | Watch Coinbase Advanced Trade USD spot in the Base App. Public charts, optional Base wallet, username-saved studies. |
| Icon | `https://YOUR-HOST/icon-512.png` |
| Screenshots | Home (`/`) and Spot (`/spot`) on a phone |
| Category | Finance / Markets (pick the closest Base.dev category) |
| Builder code | Your [builder code](https://docs.base.org/apps/builder-codes/builder-codes) |

4. Open that primary URL inside the Base App and share it.

Already-registered apps do not need to re-enter metadata unless the primary URL changes.

## Out of scope

- MiniKit / `farcaster.json`
- Moving `wallet.events` off Neon
- On-chain trading or swaps in this launch
