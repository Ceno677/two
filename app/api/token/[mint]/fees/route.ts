import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import { creatorVaultPda, OnlinePumpSdk } from "@pump-fun/pump-sdk";
import { coinCreatorVaultAtaPda, coinCreatorVaultAuthorityPda } from "@pump-fun/pump-swap-sdk";
import { getConnection } from "@/lib/solana";
import { decodeDirectionalConfig, directionalConfigPda } from "@/lib/directional-program";
import { parseCreatorFeeEvents } from "@/services/pump/events";

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
    const configInfo = await connection.getAccountInfo(configAddress, "finalized");
    if (!configInfo || !configInfo.owner.equals(programId)) return NextResponse.json({ code: "TOKEN_NOT_FOUND" }, { status: 404 });
    const config = decodeDirectionalConfig(configInfo.data);
    const pair = await new OnlinePumpSdk(connection).resolveQuoteMint(config.canonicalPairMint);
    const pumpVault = creatorVaultPda(configAddress);
    const pumpVaultQuote = getAssociatedTokenAddressSync(pair.mint, pumpVault, true, pair.quoteTokenProgram);
    const ammVault = coinCreatorVaultAtaPda(coinCreatorVaultAuthorityPda(configAddress), pair.mint, pair.quoteTokenProgram);
    const addresses = pair.mint.equals(NATIVE_MINT) ? [pumpVault, ammVault] : [pumpVaultQuote, ammVault];
    const signaturePages = await Promise.all(addresses.map((address) =>
      connection.getSignaturesForAddress(address, { limit: 200 }, "finalized"),
    ));
    const signatures = [...new Set(signaturePages.flat().filter((item) => !item.err).map((item) => item.signature))];
    let buyGenerated = 0n;
    let sellGenerated = 0n;
    for (let index = 0; index < signatures.length; index += 20) {
      const transactions = await Promise.all(signatures.slice(index, index + 20).map((signature) =>
        connection.getTransaction(signature, { commitment: "finalized", maxSupportedTransactionVersion: 0 }),
      ));
      for (const transaction of transactions) {
        if (!transaction?.meta || transaction.meta.err) continue;
        for (const event of parseCreatorFeeEvents(transaction.meta.logMessages ?? [])) {
          if (event.creator !== configAddress.toBase58()) continue;
          if (event.mint && event.mint !== mint.toBase58()) continue;
          if (event.side === "BUY") buyGenerated += event.feeAmount;
          else sellGenerated += event.feeAmount;
        }
      }
    }
    const buyPending = buyGenerated > config.buyRoutedRaw ? buyGenerated - config.buyRoutedRaw : 0n;
    const sellPending = sellGenerated > config.sellRoutedRaw ? sellGenerated - config.sellRoutedRaw : 0n;
    return NextResponse.json({
      mint: mint.toBase58(),
      scannedTransactions: signatures.length,
      buy: { generatedRaw: buyGenerated.toString(), routedRaw: config.buyRoutedRaw.toString(), pendingRaw: buyPending.toString() },
      sell: { generatedRaw: sellGenerated.toString(), routedRaw: config.sellRoutedRaw.toString(), pendingRaw: sellPending.toString() },
    }, { headers: { "cache-control": "public, s-maxage=10, stale-while-revalidate=30" } });
  } catch (error) {
    return NextResponse.json({ code: "FEE_SCAN_FAILED", message: error instanceof Error ? error.message : "Fee scan failed" }, { status: 502 });
  }
}
