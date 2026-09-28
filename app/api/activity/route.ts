import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { PUMP_PROGRAM_ID } from "@pump-fun/pump-sdk";
import { z } from "zod";
import { getConnection } from "@/lib/solana";
import { DIRECTIONAL_CONFIG_ACCOUNT_SIZE, decodeDirectionalConfig } from "@/lib/directional-program";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const registrationSchema = z.object({
  signature: z.string().min(64).max(100),
  mint: z.string(),
  creator: z.string(),
  canonicalPairMint: z.string(),
  buyFeeAssetMint: z.string(),
  sellFeeAssetMint: z.string(),
  symbol: z.string().trim().min(1).max(13).regex(/^[A-Za-z0-9]+$/),
  pairSymbol: z.string().trim().min(1).max(32),
  buySymbol: z.string().trim().min(1).max(32),
  sellSymbol: z.string().trim().min(1).max(32),
});

type PinataFile = {
  cid?: string;
  keyvalues?: Record<string, string>;
  created_at?: string;
};

type PinataList = { data?: { files?: PinataFile[] } };

function key(value: string) {
  return new PublicKey(value).toBase58();
}

async function listRegisteredLaunches(jwt: string) {
  const url = new URL("https://api.pinata.cloud/v3/files/public");
  url.searchParams.set("metadata[app]", "two");
  url.searchParams.set("metadata[kind]", "launch");
  url.searchParams.set("limit", "100");
  url.searchParams.set("order", "DESC");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${jwt}` },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Launch registry read failed (${response.status})`);
  const payload = await response.json() as PinataList;
  return (payload.data?.files ?? []).flatMap((file) => {
    const value = file.keyvalues;
    if (!value?.mint || !value.creator || !value.canonicalPairMint || !value.buyFeeAssetMint || !value.sellFeeAssetMint) return [];
    try {
      return [{
        mint: key(value.mint),
        creator: key(value.creator),
        canonicalPairMint: key(value.canonicalPairMint),
        buyFeeAssetMint: key(value.buyFeeAssetMint),
        sellFeeAssetMint: key(value.sellFeeAssetMint),
        symbol: value.symbol ?? null,
        pairSymbol: value.pairSymbol ?? null,
        buySymbol: value.buySymbol ?? null,
        sellSymbol: value.sellSymbol ?? null,
        signature: value.signature ?? null,
        registeredAt: file.created_at ?? null,
        buyRoutedRaw: "0",
        sellRoutedRaw: "0",
        enabled: true,
        paused: false,
      }];
    } catch {
      return [];
    }
  });
}

async function listProgramLaunches() {
  const programValue = process.env.DIRECTIONAL_FEE_PROGRAM_ID;
  if (!programValue) return [];
  const programId = new PublicKey(programValue);
  const accounts = await getConnection().getProgramAccounts(programId, {
    commitment: "confirmed",
    filters: [{ dataSize: DIRECTIONAL_CONFIG_ACCOUNT_SIZE }],
  });
  return accounts.map(({ pubkey, account }) => {
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
}

export async function GET() {
  try {
    const jwt = process.env.PINATA_JWT;
    if (jwt) {
      const launches = await listRegisteredLaunches(jwt);
      return NextResponse.json({ launches, source: "pinata-registry" }, {
        headers: { "cache-control": "public, s-maxage=15, stale-while-revalidate=60" },
      });
    }
    const launches = await listProgramLaunches();
    return NextResponse.json({ launches, source: "solana-program" });
  } catch (error) {
    try {
      const launches = await listProgramLaunches();
      return NextResponse.json({ launches, source: "solana-program-fallback" });
    } catch {
      return NextResponse.json({
        code: "ACTIVITY_FETCH_FAILED",
        message: error instanceof Error ? error.message : "Unable to fetch launches",
      }, { status: 503 });
    }
  }
}

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return NextResponse.json({ code: "REGISTRY_NOT_CONFIGURED" }, { status: 503 });
  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_REGISTRATION", issues: parsed.error.issues }, { status: 400 });

  try {
    const value = parsed.data;
    const mint = key(value.mint);
    const creator = key(value.creator);
    const canonicalPairMint = key(value.canonicalPairMint);
    const buyFeeAssetMint = key(value.buyFeeAssetMint);
    const sellFeeAssetMint = key(value.sellFeeAssetMint);
    const transaction = await getConnection().getTransaction(value.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!transaction || transaction.meta?.err) throw new Error("Confirmed launch transaction was not found");

    const message = transaction.transaction.message as unknown as {
      staticAccountKeys?: PublicKey[];
      accountKeys?: PublicKey[];
      header: { numRequiredSignatures: number };
    };
    const accounts = message.staticAccountKeys ?? message.accountKeys ?? [];
    const signers = accounts.slice(0, message.header.numRequiredSignatures).map((account) => account.toBase58());
    if (!signers.includes(mint) || !signers.includes(creator) || !accounts.some((account) => account.equals(PUMP_PROGRAM_ID))) {
      throw new Error("Transaction is not the matching Pump.fun launch");
    }

    const record = {
      app: "two",
      kind: "launch",
      signature: value.signature,
      mint,
      creator,
      canonicalPairMint,
      buyFeeAssetMint,
      sellFeeAssetMint,
      symbol: value.symbol.toUpperCase(),
      pairSymbol: value.pairSymbol,
      buySymbol: value.buySymbol,
      sellSymbol: value.sellSymbol,
    };
    const index = {
      app: record.app,
      kind: record.kind,
      signature: record.signature,
      mint: record.mint,
      creator: record.creator,
      canonicalPairMint: record.canonicalPairMint,
      buyFeeAssetMint: record.buyFeeAssetMint,
      sellFeeAssetMint: record.sellFeeAssetMint,
      symbol: record.symbol,
    };
    const body = new FormData();
    body.set("network", "public");
    body.set("name", `two-launch-${mint}.json`);
    body.set("keyvalues", JSON.stringify(index));
    body.set("file", new File([JSON.stringify(record)], `two-launch-${mint}.json`, { type: "application/json" }));
    const upload = await fetch("https://uploads.pinata.cloud/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    if (!upload.ok) {
      const detail = (await upload.text()).slice(0, 300);
      throw new Error(`Launch registry write failed (${upload.status}): ${detail}`);
    }
    const result = await upload.json() as { data?: { cid?: string } };
    return NextResponse.json({ registered: true, cid: result.data?.cid ?? null });
  } catch (error) {
    return NextResponse.json({
      code: "REGISTRATION_FAILED",
      message: error instanceof Error ? error.message : "Launch could not be registered",
    }, { status: 422 });
  }
}
