import { NextResponse } from "next/server";
const required = ["SOLANA_RPC_URL", "JUPITER_API_KEY", "PINATA_JWT"] as const;

export async function GET() {
  const checks = Object.fromEntries(required.map((name) => [name, Boolean(process.env[name])]));
  const ready = Object.values(checks).every(Boolean);
  return NextResponse.json({ status: ready ? "ready" : "configuration_required", checks }, { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } });
}
