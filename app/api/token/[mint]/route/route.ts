import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";
import { z } from "zod";
import { getConnection } from "@/lib/solana";
import {
  decodeDirectionalConfig,
  directionalConfigPda,
  executeDirectionalRouteInstruction,
} from "@/lib/directional-program";
import { JupiterAdapter } from "@/services/router/jupiter";
import type { RouterInstruction } from "@/services/router/types";

export const runtime = "nodejs";

const requestSchema = z.object({
  authority: z.string(),
  side: z.enum(["BUY", "SELL"]),
  amountRaw: z.string().regex(/^\d+$/),
});

function publicKey(value: string, label: string) {
  try { return new PublicKey(value); }
  catch { throw new Error(`Invalid ${label}`); }
}

function instruction(raw: RouterInstruction) {
  return new TransactionInstruction({
    programId: new PublicKey(raw.programId),
    keys: raw.accounts.map((account) => ({
      pubkey: new PublicKey(account.pubkey),
      isSigner: account.isSigner,
      isWritable: account.isWritable,
    })),
    data: Buffer.from(raw.data, "base64"),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ mint: string }> }) {
  if (!process.env.DIRECTIONAL_FEE_PROGRAM_ID || process.env.MAINNET_CANARY_VERIFIED !== "true") {
    return NextResponse.json({ code: "ROUTING_NOT_ENABLED" }, { status: 503 });
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_REQUEST", issues: parsed.error.issues }, { status: 400 });

  try {
    const { mint: mintValue } = await params;
    const mint = publicKey(mintValue, "token mint");
    const authority = publicKey(parsed.data.authority, "authority");
    const amount = BigInt(parsed.data.amountRaw);
    if (amount <= 0n) return NextResponse.json({ code: "INVALID_ROUTE_AMOUNT" }, { status: 400 });
    const programId = new PublicKey(process.env.DIRECTIONAL_FEE_PROGRAM_ID);
    const configAddress = directionalConfigPda(programId, mint);
    const connection = getConnection();
    const configInfo = await connection.getAccountInfo(configAddress, "confirmed");
    if (!configInfo || !configInfo.owner.equals(programId)) return NextResponse.json({ code: "CONFIG_NOT_FOUND" }, { status: 404 });
    const config = decodeDirectionalConfig(configInfo.data);
    if (!config.tokenMint.equals(mint)) throw new Error("Config token mint mismatch");
    if (!config.routeAuthority.equals(authority)) return NextResponse.json({ code: "UNAUTHORIZED_ROUTE_AUTHORITY" }, { status: 403 });
    if (!config.enabled || config.paused) return NextResponse.json({ code: "ROUTING_PAUSED" }, { status: 409 });

    const destinationMint = parsed.data.side === "BUY" ? config.buyFeeAssetMint : config.sellFeeAssetMint;
    const destinationOwner = parsed.data.side === "BUY" ? config.buyDestination : config.sellDestination;
    const pump = new OnlinePumpSdk(connection);
    const pair = await pump.resolveQuoteMint(config.canonicalPairMint);
    const destinationMintInfo = await connection.getAccountInfo(destinationMint, "confirmed");
    if (!destinationMintInfo) return NextResponse.json({ code: "DESTINATION_MINT_NOT_FOUND" }, { status: 422 });
    const destinationTokenProgram = destinationMintInfo.owner;
    if (!destinationTokenProgram.equals(TOKEN_PROGRAM_ID) && !destinationTokenProgram.equals(TOKEN_2022_PROGRAM_ID)) {
      return NextResponse.json({ code: "INVALID_DESTINATION_MINT" }, { status: 422 });
    }

    const inputVault = getAssociatedTokenAddressSync(pair.mint, configAddress, true, pair.quoteTokenProgram);
    const outputVault = getAssociatedTokenAddressSync(destinationMint, destinationOwner, true, destinationTokenProgram);
    const outputInfo = await connection.getAccountInfo(outputVault, "confirmed");
    const unwrapSol = destinationMint.equals(NATIVE_MINT);
    if (unwrapSol && !destinationOwner.equals(authority)) {
      return NextResponse.json({ code: "SOL_DESTINATION_MUST_SIGN" }, { status: 422 });
    }
    if (unwrapSol && outputInfo) {
      const balance = await connection.getTokenAccountBalance(outputVault, "confirmed");
      if (BigInt(balance.value.amount) !== 0n) return NextResponse.json({ code: "WSOL_DESTINATION_NOT_EMPTY" }, { status: 409 });
    }

    const collect = pair.mint.equals(NATIVE_MINT)
      ? await pump.collectCoinCreatorFeeInstructions(configAddress, authority)
      : await pump.collectCoinCreatorFeeV2Instructions(configAddress, pair.mint, pair.quoteTokenProgram, authority);
    const router = new JupiterAdapter(connection);
    const quote = await router.getQuote({
      inputMint: pair.mint.toBase58(),
      outputMint: destinationMint.toBase58(),
      amount,
      slippageBps: config.maxSlippageBps,
    });
    const built = await router.buildRoute(quote, configAddress.toBase58(), outputVault.toBase58(), authority.toBase58());
    if (!built.swapInstruction) throw new Error("Jupiter swap instruction missing");
    const currentSlot = await connection.getSlot("confirmed");
    const batchId = randomBytes(32);
    const execute = executeDirectionalRouteInstruction({
      programId,
      config: configAddress,
      routeAuthority: authority,
      inputVault,
      outputVault,
      tokenProgram: pair.quoteTokenProgram,
      batchId,
      side: parsed.data.side,
      amountIn: amount,
      minimumOutput: quote.minimumOutput,
      expirySlot: BigInt(currentSlot + 100),
      jupiterSwapInstruction: built.swapInstruction,
    });
    const createOutput = createAssociatedTokenAccountIdempotentInstruction(
      authority, outputVault, destinationOwner, destinationMint, destinationTokenProgram,
    );
    const instructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_200_000 }),
      ...collect,
      createOutput,
      ...(built.setupInstructions ?? []).map(instruction),
      execute.instruction,
      ...(built.cleanupInstruction ? [instruction(built.cleanupInstruction)] : []),
      ...(unwrapSol ? [createCloseAccountInstruction(outputVault, destinationOwner, destinationOwner, [], destinationTokenProgram)] : []),
    ];
    const lookupTables = (await Promise.all((built.addressLookupTableAddresses ?? []).map(async (address) =>
      (await connection.getAddressLookupTable(new PublicKey(address))).value,
    ))).filter((table): table is AddressLookupTableAccount => table !== null);
    const latest = await connection.getLatestBlockhash("confirmed");
    const message = new TransactionMessage({
      payerKey: authority,
      recentBlockhash: latest.blockhash,
      instructions,
    }).compileToV0Message(lookupTables);
    const transaction = new VersionedTransaction(message);

    return NextResponse.json({
      transaction: Buffer.from(transaction.serialize()).toString("base64"),
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
      batchId: batchId.toString("hex"),
      receipt: execute.receipt.toBase58(),
      amountIn: amount.toString(),
      expectedOutput: quote.expectedOutput.toString(),
      minimumOutput: quote.minimumOutput.toString(),
      outputMint: destinationMint.toBase58(),
    });
  } catch (error) {
    return NextResponse.json({
      code: "ROUTE_BUILD_FAILED",
      message: error instanceof Error ? error.message : "Route transaction could not be constructed",
    }, { status: 502 });
  }
}
