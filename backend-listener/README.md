# GreenTrace listener

A small background service for GreenTrace. It polls the Hedera mirror node for events from the `GreenTraceExchange` contract (credit purchases and retirement requests) and reports each transaction to the GreenTrace app's `/api/internal/reconcile` endpoint, which verifies it and completes the order or retirement.

The browser normally reports these transactions itself, and the deployed app also runs a scheduled scan every minute (Supabase pg_cron calling `/api/internal/scan`), so this service is optional.
Run it when you want closed-tab purchases completed within seconds instead of within a minute.
The app's processing is idempotent, so the listener, the scan and the browser can all report the same transaction safely.

## Run

```bash
cd backend-listener
npm install
cp .env.example .env   # fill in APP_URL, INTERNAL_API_SECRET, EXCHANGE_CONTRACT_ID
npm start
```

It logs one JSON line per event. It keeps no database or state of its own; on start it looks back `LOOKBACK_SECONDS` (default one hour).

Runs anywhere that keeps a Node 20+ process alive (a background worker, a small VM). Built for the IEEE ClimateChain Global Hackathon 2026.
