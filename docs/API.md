# API Configuration

## SpacetimeDB (anonymous read)

When users are not authenticated, the app fetches blocks and comments via `/api/v1/data`, which runs SQL against SpacetimeDB over HTTP.

| Variable | Description |
| -------- | ----------- |
| `SPACETIMEDB_SERVER_TOKEN` | Optional. Server token from SpacetimeDB dashboard for SQL queries. If unset, the API calls `POST /v1/identity` to obtain an ephemeral token. If your database has anonymous sign-in disabled, the ephemeral token may not have read access—set this token for reliable anonymous reads. |

## Stripe

| Variable | Description |
| -------- | ----------- |
| `STRIPE_SECRET_KEY` | Secret key from [Stripe Dashboard](https://dashboard.stripe.com/apikeys) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Publishable key (client-side) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `/api/v1/stripe/webhooks` (Connect, ads) |
| `STRIPE_CREDITS_WEBHOOK_SECRET` | Signing secret for `/api/v1/webhooks/stripe` (credits) — can reuse `STRIPE_WEBHOOK_SECRET` |

## Auth Callback (OIDC)

The auth callback is at `/api/v1/auth/callback`. Set the redirect URI in your environment and Spacetime Auth dashboard.

- **Environment variable:** `NEXT_PUBLIC_SPACETIMEAUTH_REDIRECT_URI` — full callback URL, e.g. `http://localhost:3000/api/v1/auth/callback` (dev) or `https://yourdomain.com/api/v1/auth/callback` (prod)
- **Spacetime Auth dashboard:** Add the same URL as a redirect URI

## Stripe Webhooks

- **Connect / Ads:** `/api/v1/stripe/webhooks`
- **Credits:** `/api/v1/webhooks/stripe`

Configure these endpoints in the Stripe Dashboard.
