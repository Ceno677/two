import { NextResponse } from "next/server";
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";
import { load } from "cheerio";
import { getConnection } from "@/lib/solana";
import { ASSETS } from "@/lib/data";

export const dynamic = "force-dynamic";

async function fetchOfficialLabels() {
  const response = await fetch("https://pump.fun/docs/custom-pairs", { cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Pump docs returned HTTP ${response.status}`);
  const $ = load(await response.text());
  const labels = new Map<string, { symbol: string; name: string }>();
  $("table tbody tr").each((_, row) => {
    const cells = $(row).find("td").map((__, cell) => $(cell).text().trim()).get();
    if (cells.length >= 5 && cells[0] && cells[1] && cells[4]) labels.set(cells[4], { symbol: cells[0], name: cells[1] });
  });
  return labels;
}

export async function GET() {
  try {
    const [supported, officialLabels] = await Promise.all([
      new OnlinePumpSdk(getConnection()).fetchSupportedQuoteMints(),
      fetchOfficialLabels().catch(() => new Map<string, { symbol: string; name: string }>()),
    ]);
    const knownByMint = new Map(Object.values(ASSETS).map((asset) => [asset.mint, asset]));
    return NextResponse.json({
      source: "pump-onchain",
      fetchedAt: new Date().toISOString(),
      assets: supported.map((item) => {
        const mint = item.mint.toBase58();
        const known = knownByMint.get(mint);
        const official = officialLabels.get(mint);
        return { mint, symbol: official?.symbol ?? known?.symbol ?? null, name: official?.name ?? known?.name ?? null, source: item.source, initialVirtualQuoteReserves: item.initialVirtualQuoteReserves.toString() };
      }),
    }, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    return NextResponse.json({ code: "PUMP_ASSET_FETCH_FAILED", message: error instanceof Error ? error.message : "Unable to fetch supported assets" }, { status: 503 });
  }
}
