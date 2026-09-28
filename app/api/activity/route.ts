import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getConnection } from "@/lib/solana";
import { DIRECTIONAL_CONFIG_ACCOUNT_SIZE, decodeDirectionalConfig } from "@/lib/directional-program";

export const dynamic = "force-dynamic";

export async function GET() {
  const programValue = process.env.DIRECTIONAL_FEE_PROGRAM_ID;
  if (!programValue) return NextResponse.json({ launches: [], status: "PROGRAM_NOT_CONFIGURED" });
  try {
    const programId = new PublicKey(programValue);
    const accounts = await getConnection().getProgramAccounts(programId, {
      commitment: "confirmed",
      filters: [{ dataSize: DIRECTIONAL_CONFIG_ACCOUNT_SIZE }],
    });
    const launches = accounts.map(({ pubkey, account }) => {
      const config = decodeDirectionalConfig(account.data);
      return {
        config: pubkey.toBase58(),
        mint: config.tokenMint.toBase58(),
        creator: config.authority.toBase58(),
        canonicalPairMint: config.canonicalPairMint.toBase58(),
        buyFeeAssetMint: config.buyFeeAssetMint.toBase58(),
        sellFeeAssetMint: config.sellFeeAssetMint.toBase58(),
        buyRoutedRaw: config.buyRoutedRaw.toString(),
        sellRoutedRaw: config.sellRoutedRaw.toString(),
        enabled: config.enabled,
        paused: config.paused,
      };
    });
    return NextResponse.json({ launches, source: "solana-program" }, {
      headers: { "cache-control": "public, s-maxage=15, stale-while-revalidate=60" },
    });
  } catch (error) {
    return NextResponse.json({ code: "ACTIVITY_FETCH_FAILED", message: error instanceof Error ? error.message : "Unable to fetch launches" }, { status: 503 });
  }
}
