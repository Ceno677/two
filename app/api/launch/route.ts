import { NextResponse } from "next/server";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { OnlinePumpSdk, PUMP_SDK } from "@pump-fun/pump-sdk";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { z } from "zod";
import { getConnection } from "@/lib/solana";
import { initializeDirectionalConfigInstruction } from "@/lib/directional-program";
import { getDirectionalProgramStatus } from "@/lib/program-status";

export const runtime = "nodejs";

const requestSchema = z.object({
  authority: z.string(),
  mint: z.string(),
  name: z.string().trim().min(1).max(32),
  symbol: z.string().trim().min(1).max(13).regex(/^[A-Za-z0-9]+$/),
  metadataUri: z.string().trim().min(1).max(200),
  canonicalPairMint: z.string(),
  buyFeeAssetMint: z.string(),
  sellFeeAssetMint: z.string(),
  protocolShareBps: z.number().int().min(0).max(2_000).default(500),
  maxSlippageBps: z.number().int().min(1).max(500).default(100),
});

function publicKey(value: string, field: string) {
  try {
    return new PublicKey(value);
  } catch {
    throw new Error(`Invalid ${field}`);
  }
}

export async function POST(request: Request) {
  const program = await getDirectionalProgramStatus();
  if (!program.ready) {
    return NextResponse.json({
      code: "LAUNCH_NOT_ENABLED",
      message: "The directional fee program has not been deployed on Solana mainnet yet.",
    }, { status: 503 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_REQUEST", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const authority = publicKey(parsed.data.authority, "authority");
    const mint = publicKey(parsed.data.mint, "mint");
    const programId = program.programId;
    const pair = publicKey(parsed.data.canonicalPairMint, "pair mint");
    const buyMint = publicKey(parsed.data.buyFeeAssetMint, "buy fee mint");
    const sellMint = publicKey(parsed.data.sellFeeAssetMint, "sell fee mint");
    const connection = getConnection();
    const pump = new OnlinePumpSdk(connection);
    const resolvedPair = await pump.resolveQuoteMint(pair);
    const [mintAccount, buyAccount, sellAccount] = await connection.getMultipleAccountsInfo([
      mint,
      buyMint,
      sellMint,
    ], "confirmed");
    if (mintAccount) {
      return NextResponse.json({ code: "MINT_ALREADY_EXISTS" }, { status: 409 });
    }
    if (!buyAccount || !sellAccount) {
      return NextResponse.json({ code: "DESTINATION_MINT_NOT_FOUND" }, { status: 422 });
    }

    const { config, instruction: initializeConfig } = initializeDirectionalConfigInstruction({
      programId,
      authority,
      tokenMint: mint,
      routeAuthority: authority,
      canonicalPairMint: pair,
      buyFeeAssetMint: buyMint,
      sellFeeAssetMint: sellMint,
      buyDestination: authority,
      sellDestination: authority,
      routingThresholdRaw: 5n * 10n ** BigInt(Math.max(0, resolvedPair.decimals - 2)),
      maxBatchIntervalSeconds: 1_800,
      protocolShareBps: parsed.data.protocolShareBps,
      maxSlippageBps: parsed.data.maxSlippageBps,
    });
    const createCoin = await PUMP_SDK.createV2Instruction({
      mint,
      name: parsed.data.name,
      symbol: parsed.data.symbol.toUpperCase(),
      uri: parsed.data.metadataUri,
      creator: config,
      user: authority,
      mayhemMode: false,
      cashback: false,
      quoteMint: resolvedPair.mint,
      quoteTokenProgram: resolvedPair.quoteTokenProgram,
      holderReward: false,
    });
    const configQuoteVault = getAssociatedTokenAddressSync(
      resolvedPair.mint,
      config,
      true,
      resolvedPair.quoteTokenProgram,
    );
    const createConfigQuoteVault = createAssociatedTokenAccountIdempotentInstruction(
      authority,
      configQuoteVault,
      config,
      resolvedPair.mint,
      resolvedPair.quoteTokenProgram,
    );
    const createBlockhash = await connection.getLatestBlockhash("confirmed");
    const createTransaction = new Transaction({
      feePayer: authority,
      blockhash: createBlockhash.blockhash,
      lastValidBlockHeight: createBlockhash.lastValidBlockHeight,
    }).add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      createCoin,
    );
    const configureBlockhash = await connection.getLatestBlockhash("confirmed");
    const configureTransaction = new Transaction({
      feePayer: authority,
      blockhash: configureBlockhash.blockhash,
      lastValidBlockHeight: configureBlockhash.lastValidBlockHeight,
    }).add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
      initializeConfig,
      createConfigQuoteVault,
    );

    const encode = (transaction: Transaction) => transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }).toString("base64");

    return NextResponse.json({
      transactions: [
        { kind: "CREATE_TOKEN", transaction: encode(createTransaction), ...createBlockhash },
        { kind: "CONFIGURE_DIRECTIONAL_FEES", transaction: encode(configureTransaction), ...configureBlockhash },
      ],
      mint: mint.toBase58(),
      config: config.toBase58(),
      configQuoteVault: configQuoteVault.toBase58(),
    });
  } catch (error) {
    return NextResponse.json({
      code: "LAUNCH_BUILD_FAILED",
      message: error instanceof Error ? error.message : "Launch transaction could not be constructed",
    }, { status: 502 });
  }
}
