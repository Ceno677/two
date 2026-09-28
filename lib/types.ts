export type TradeSide = "BUY" | "SELL";
export type Finality = "OBSERVED" | "CONFIRMED" | "FINALIZED";
export type BatchStatus = "PENDING" | "READY_TO_ROUTE" | "QUOTING" | "ROUTE_CREATED" | "SUBMITTED" | "CONFIRMED" | "FAILED" | "RETRYABLE" | "SETTLED";

export interface Asset {
  symbol: string;
  name: string;
  chain: "solana" | "bitcoin" | "ethereum" | "near" | "zcash";
  mint: string;
  decimals: number;
  accent: string;
}

export interface DirectionalFeeToken {
  mint: string; name: string; symbol: string; canonicalPair: Asset;
  buyFeeAsset: Asset; sellFeeAsset: Asset; marketCap: number; volume24h: number;
  fees24h: number; buyFeesRaw: number; sellFeesRaw: number; buyAcquired: number;
  sellAcquired: number; progress: number; holders: number; creator: string; age: string;
}

export interface PumpFeeEventInput {
  signature: string; eventIndex: number; slot: bigint; mint: string; creator: string;
  side: TradeSide; feeAmount: bigint; quoteMint: string;
  venue: "PUMP_BONDING_CURVE" | "PUMPSWAP"; blockTime: Date | null; finality: Finality;
}

export interface RouteQuote {
  provider: "JUPITER" | "NEAR_INTENTS"; inputMint: string; outputMint: string;
  inputAmount: bigint; expectedOutput: bigint; minimumOutput: bigint;
  priceImpactPct: string; expiresAt: Date; raw: unknown;
}
