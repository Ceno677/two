import { randomUUID } from "node:crypto";
import type { Finality, PumpFeeEventInput, TradeSide } from "@/lib/types";
import type { FeeBatchRecord, FeeConfiguration, FeeLedgerRepository, StoredFeeEvent } from "./types";

export class FeeIntegrityError extends Error {}

export class DirectionalFeeEngine {
  constructor(private readonly repo: FeeLedgerRepository, private readonly now = () => new Date()) {}

  async ingest(input: PumpFeeEventInput): Promise<"INSERTED" | "DUPLICATE" | "IGNORED"> {
    const config = await this.repo.getConfigByMint(input.mint);
    if (!config || !config.enabled) return "IGNORED";
    if (input.creator !== config.pumpCreatorPda) throw new FeeIntegrityError("Pump event creator does not match configured creator PDA");
    if (input.quoteMint !== config.canonicalPairMint) throw new FeeIntegrityError("Pump event quote mint does not match canonical pair");
    if (input.feeAmount <= 0n) return "IGNORED";

    const event: StoredFeeEvent = {
      ...input,
      id: `${input.signature}:${input.eventIndex}`,
      destinationAsset: input.side === "BUY" ? config.buyFeeAssetMint : config.sellFeeAssetMint,
    };
    return this.repo.insertEvent(event);
  }

  async advanceFinality(signature: string, eventIndex: number, finality: Finality) {
    await this.repo.updateEventFinality(signature, eventIndex, finality);
  }

  async prepareBatch(config: FeeConfiguration, side: TradeSide): Promise<FeeBatchRecord | null> {
    const events = await this.repo.listUnbatchedFinalized(config.tokenMint, side);
    if (events.length === 0) return null;
    const rawAmount = events.reduce((total, event) => total + event.feeAmount, 0n);
    const oldest = await this.repo.getOldestUnbatchedAt(config.tokenMint, side);
    const intervalElapsed = oldest !== null && this.now().getTime() - oldest.getTime() >= config.maxBatchIntervalMs;
    if (rawAmount < config.routingThresholdRaw && !intervalElapsed) return null;

    const protocolFeeAmount = rawAmount * BigInt(config.protocolShareBps) / 10_000n;
    const batch: FeeBatchRecord = {
      id: randomUUID(), tokenMint: config.tokenMint, side, rawAmount, protocolFeeAmount,
      routableAmount: rawAmount - protocolFeeAmount, inputAsset: config.canonicalPairMint,
      outputAsset: side === "BUY" ? config.buyFeeAssetMint : config.sellFeeAssetMint,
      status: "READY_TO_ROUTE", eventIds: events.map((event) => event.id), createdAt: this.now(),
    };
    await this.repo.createBatch(batch);
    return batch;
  }

  async markRoutingFailure(batchId: string, message: string): Promise<void> {
    const changed = await this.repo.transitionBatch(batchId, ["QUOTING", "ROUTE_CREATED", "SUBMITTED", "CONFIRMED"], "RETRYABLE", message);
    if (!changed) throw new FeeIntegrityError("Invalid batch failure transition");
  }

  async markSettled(batchId: string): Promise<void> {
    const changed = await this.repo.transitionBatch(batchId, ["CONFIRMED"], "SETTLED");
    if (!changed) throw new FeeIntegrityError("Only a confirmed route can settle");
  }
}
