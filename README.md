# Directional Fees

[Live engineering preview](https://near-jade.vercel.app) · [Source repository](https://github.com/Ceno677/two)

Directional Fees is a Pump.fun launchpad concept where normal token trading remains untouched while creator-fee revenue is accounted for and routed by trade direction:

```text
BUY-generated creator fees  → Asset A
SELL-generated creator fees → Asset B
```

The current deployment is an engineering preview. Real launches and routing remain deliberately disabled until the custody program is deployed, audited, and verified with restricted mainnet canaries.

## Implemented

- Next.js launch, discovery, token, and creator-dashboard interfaces
- all Pump-supported quote mints discovered through Pump's onchain SDK
- official Pump bonding-curve and PumpSwap event decoding
- immutable BUY/SELL creator-fee accounting
- finalized-only batching and duplicate-event protection
- PostgreSQL/Prisma persistence model and transactional batch claiming
- Jupiter quote and route construction adapter
- production infrastructure preflight and health endpoint

## Safety model

Traders always receive ordinary Pump outputs. Only creator-fee revenue is routed. A failed destination conversion remains retryable in its canonical raw asset; it is never silently substituted or marked settled early.

Public execution is gated until all of the following exist:

- deployed Directional Fees Solana program
- program-controlled creator and destination vaults
- audited route authorization and settlement instructions
- persistent keeper/indexer service
- successful BUY, SELL, failure-recovery, and PumpSwap-graduation canaries

## Local development

```bash
npm install
cp .env.example .env.local
npm run db:generate
npm run dev
```

Open `http://localhost:3000`.

Verification:

```bash
npm run typecheck
npm test
npm run build
npm run preflight
```

## Deployment topology

- Vercel: Next.js frontend and bounded request/response APIs
- persistent Node.js worker: Pump/PumpSwap indexing, finality, batching, routing, and reconciliation
- PostgreSQL: immutable fee ledger and indexed product state
- Redis/BullMQ: durable keeper jobs and retries
- Solana mainnet: Pump programs plus the Directional Fees custody program

## External services

See `.env.example` for the complete contract. Required services include two Solana RPC providers, PostgreSQL, Redis, Jupiter, and metadata storage.

## Status

This repository does not currently grant permission to deploy unaudited custody code with public funds. No license has been added.
