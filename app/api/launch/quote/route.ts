import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";
import { z } from "zod";
import { getConnection } from "@/lib/solana";

const requestSchema = z.object({
  name: z.string().trim().min(1).max(32),
  symbol: z.string().trim().min(1).max(13).regex(/^[A-Za-z0-9]+$/),
  canonicalPairMint: z.string(),
  buyFeeAssetMint: z.string(),
  sellFeeAssetMint: z.string(),
  protocolShareBps: z.number().int().min(0).max(2_000).default(500),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_REQUEST", issues: parsed.error.issues }, { status: 400 });
  try {
    const connection = getConnection();
    const pair = new PublicKey(parsed.data.canonicalPairMint);
    const buyMint = new PublicKey(parsed.data.buyFeeAssetMint);
    const sellMint = new PublicKey(parsed.data.sellFeeAssetMint);
    const pump = new OnlinePumpSdk(connection);
    const supported = await pump.fetchSupportedQuoteMints();
    if (!supported.some((asset) => asset.mint.equals(pair))) return NextResponse.json({ code: "UNSUPPORTED_PUMP_PAIR" }, { status: 422 });
    const resolvedPair = await pump.resolveQuoteMint(pair);
    const accounts = await connection.getMultipleAccountsInfo([buyMint, sellMint], "confirmed");
    const validOwner = (owner: PublicKey) => owner.equals(TOKEN_PROGRAM_ID) || owner.equals(TOKEN_2022_PROGRAM_ID);
    if (accounts.some((account) => !account || !validOwner(account.owner))) return NextResponse.json({ code: "INVALID_DESTINATION_MINT" }, { status: 422 });
    return NextResponse.json({
      verifiedAt: new Date().toISOString(),
      canonicalPairMint: pair.toBase58(), buyFeeAssetMint: buyMint.toBase58(), sellFeeAssetMint: sellMint.toBase58(),
      traderOutputModified: false, protocolShareBps: parsed.data.protocolShareBps,
      canonicalPairDecimals: resolvedPair.decimals,
      routeTrigger: { minimumRawAmount: (5n * 10n ** BigInt(Math.max(0, resolvedPair.decimals - 2))).toString(), displayAmount: "0.05", maximumIntervalSeconds: 1800 },
      executionReady: true,
      executionMode: "DIRECT_CREATOR",
      executionReason: null,
    });
  } catch (error) {
    return NextResponse.json({ code: "QUOTE_FAILED", message: error instanceof Error ? error.message : "Quote validation failed" }, { status: 503 });
  }
}
