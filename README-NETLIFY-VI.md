# BTC dashboard – Coinalyze auto refresh

This package preserves the existing static dashboard and adds server-side Coinalyze Long/Short refresh.

## Netlify setup
- Environment variable required: `COINALYZE_API_KEY` (Secret; Functions scope enabled).
- `netlify.toml` publishes the `public/` directory and registers `netlify/functions`.
- `@netlify/blobs` stores the latest `urpd-lsr.json` snapshot so refreshes persist across deploys.
- Scheduled function: `refresh-lsr` at `0 0 * * *` UTC = 07:00 Asia/Ho_Chi_Minh.
- Manual endpoint: `POST /api/refresh-lsr` (separate synchronous function from the scheduled job).
- Data endpoint: `GET /api/lsr`.

## Behavior
- Coinalyze markets are discovered dynamically. Up to 8 BTC/USDT perpetual markets with long/short-ratio support are selected, prioritizing major venues.
- Daily and 4-hour long/short ratio history is fetched. The percentage of Long is derived as `100 * ratio / (1 + ratio)` and averaged across selected venues.
- The previous snapshot is not overwritten unless both intervals return enough usable observations.
- The dashboard's existing candle OHLC series is retained; only the Long percentage series is refreshed.

## Scope limitation
This update automates the Long/Short panel only. The other on-chain/URPD/whale/realized-profit datasets remain the static snapshots included in this package until their upstream data sources are separately integrated.
