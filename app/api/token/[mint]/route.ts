import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";
import { getConnection } from "@/lib/solana";
import { decodeDirectionalConfig, directionalConfigPda } from "@/lib/directional-program";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ mint: string }> }) {
  try {
    const { mint: mintValue } = await params;
    const mint = new PublicKey(mintValue);
    const programValue = process.env.DIRECTIONAL_FEE_PROGRAM_ID;
    if (!programValue) return NextResponse.json({ code: "PROGRAM_NOT_CONFIGURED" }, { status: 503 });
    const programId = new PublicKey(programValue);
    const configAddress = directionalConfigPda(programId, mint);
    const connection = getConnection();
    const [account, bondingCurve] = await Promise.all([
      connection.getAccountInfo(configAddress, "confirmed"),
      new OnlinePumpSdk(connection).fetchBondingCurve(mint).catch(() => null),
    ]);
    if (!account || !account.owner.equals(programId)) return NextResponse.json({ code: "TOKEN_NOT_FOUND" }, { status: 404 });
    const config = decodeDirectionalConfig(account.data);
    return NextResponse.json({
      mint: config.tokenMint.toBase58(),
      config: configAddress.toBase58(),
      authority: config.authority.toBase58(),
      canonicalPairMint: config.canonicalPairMint.toBase58(),
      buyFeeAssetMint: config.buyFeeAssetMint.toBase58(),
      sellFeeAssetMint: config.sellFeeAssetMint.toBase58(),
      buyDestination: config.buyDestination.toBase58(),
      sellDestination: config.sellDestination.toBase58(),
      routingThresholdRaw: config.routingThresholdRaw.toString(),
      buyRoutedRaw: config.buyRoutedRaw.toString(),
      sellRoutedRaw: config.sellRoutedRaw.toString(),
      enabled: config.enabled,
      paused: config.paused,
      pump: bondingCurve ? {
        complete: bondingCurve.complete,
        creator: bondingCurve.creator.toBase58(),
        creatorFeeBps: bondingCurve.creatorFeeBps.toString(),
      } : null,
    }, { headers: { "cache-control": "public, s-maxage=10, stale-while-revalidate=30" } });
  } catch (error) {
    return NextResponse.json({ code: "TOKEN_LOOKUP_FAILED", message: error instanceof Error ? error.message : "Lookup failed" }, { status: 400 });
  }
}
