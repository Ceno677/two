import "dotenv/config";
import pg from "pg";
import Redis from "ioredis";

const required = [
  "DATABASE_URL", "REDIS_URL", "SOLANA_RPC_URL", "SOLANA_WS_URL",
  "SOLANA_BACKUP_RPC_URL", "SOLANA_BACKUP_WS_URL", "JUPITER_API_KEY",
  "PINATA_JWT", "PINATA_GATEWAY", "INTERNAL_ROUTE_SECRET",
];
const deploymentOnly = ["DIRECTIONAL_FEE_PROGRAM_ID", "KEEPER_KEYPAIR_PATH"];
const results = [];
const record = (name, ok, detail) => results.push({ name, ok, detail });

for (const name of required) record(name, Boolean(process.env[name]), process.env[name] ? "configured" : "missing");
for (const name of deploymentOnly) record(name, Boolean(process.env[name]), process.env[name] ? "configured" : "required after program deployment");

async function rpc(name, url) {
  if (!url) return;
  try {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }), signal: AbortSignal.timeout(8000) });
    const body = await response.json();
    record(name, response.ok && body.result === "ok", body.result ?? body.error?.message ?? `HTTP ${response.status}`);
  } catch (error) { record(name, false, error instanceof Error ? error.message : "connection failed"); }
}

await rpc("primary RPC health", process.env.SOLANA_RPC_URL);
await rpc("backup RPC health", process.env.SOLANA_BACKUP_RPC_URL);

if (process.env.DATABASE_URL) {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, max: 1 });
  try { await pool.query("SELECT 1"); record("PostgreSQL health", true, "connected"); }
  catch (error) { record("PostgreSQL health", false, error instanceof Error ? error.message : "connection failed"); }
  finally { await pool.end(); }
}

if (process.env.REDIS_URL) {
  const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 5000, maxRetriesPerRequest: 0 });
  try { await redis.connect(); await redis.ping(); record("Redis health", true, "connected"); }
  catch (error) { record("Redis health", false, error instanceof Error ? error.message : "connection failed"); }
  finally { redis.disconnect(); }
}

for (const result of results) console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name}: ${result.detail}`);
const blockers = results.filter((result) => !result.ok);
if (blockers.length) { console.error(`\n${blockers.length} production blocker(s) remain.`); process.exitCode = 1; }
else console.log("\nProduction infrastructure preflight passed.");
