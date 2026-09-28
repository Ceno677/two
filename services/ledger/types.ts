import type { BatchStatus, Finality, PumpFeeEventInput, TradeSide } from "@/lib/types";

export interface FeeConfiguration {
  tokenId: string;
  tokenMint: string;
  pumpCreatorPda: string;
  canonicalPairMint: string;
  buyFeeAssetMint: string;
  sellFeeAssetMint: string;
  routingThresholdRaw: bigint;
  maxBatchIntervalMs: number;
  maxSlippageBps: number;
  protocolShareBps: number;
  enabled: boolean;
}

export interface StoredFeeEvent extends PumpFeeEventInput {
  id: string;
  destinationAsset: string;
  batchId?: string;
}

export interface FeeBatchRecord {
  id: string;
  tokenMint: string;
  side: TradeSide;
  rawAmount: bigint;
  protocolFeeAmount: bigint;
  routableAmount: bigint;
  inputAsset: string;
  outputAsset: string;
  status: BatchStatus;
  eventIds: string[];
  createdAt: Date;
  lastError?: string;
}

export interface FeeLedgerRepository {
  getConfigByMint(mint: string): Promise<FeeConfiguration | null>;
  getConfigByPool(pool: string): Promise<FeeConfiguration | null>;
  insertEvent(event: StoredFeeEvent): Promise<"INSERTED" | "DUPLICATE">;
  updateEventFinality(signature: string, eventIndex: number, finality: Finality): Promise<void>;
  listUnbatchedFinalized(tokenMint: string, side: TradeSide): Promise<StoredFeeEvent[]>;
  getOldestUnbatchedAt(tokenMint: string, side: TradeSide): Promise<Date | null>;
  createBatch(batch: FeeBatchRecord): Promise<void>;
  transitionBatch(id: string, from: BatchStatus[], to: BatchStatus, error?: string): Promise<boolean>;
}
