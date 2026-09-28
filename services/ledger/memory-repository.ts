import type { BatchStatus, Finality, TradeSide } from "@/lib/types";
import type { FeeBatchRecord, FeeConfiguration, FeeLedgerRepository, StoredFeeEvent } from "./types";

const finalityRank: Record<Finality, number> = { OBSERVED: 0, CONFIRMED: 1, FINALIZED: 2 };

export class MemoryFeeLedgerRepository implements FeeLedgerRepository {
  readonly events = new Map<string, StoredFeeEvent>();
  readonly batches = new Map<string, FeeBatchRecord>();
  readonly configs = new Map<string, FeeConfiguration>();
  readonly pools = new Map<string, string>();

  addConfig(config: FeeConfiguration, pool?: string) {
    this.configs.set(config.tokenMint, config);
    if (pool) this.pools.set(pool, config.tokenMint);
  }
  async getConfigByMint(mint: string) { return this.configs.get(mint) ?? null; }
  async getConfigByPool(pool: string) { const mint = this.pools.get(pool); return mint ? this.getConfigByMint(mint) : null; }
  async insertEvent(event: StoredFeeEvent) {
    if (this.events.has(event.id)) return "DUPLICATE" as const;
    this.events.set(event.id, structuredClone(event));
    return "INSERTED" as const;
  }
  async updateEventFinality(signature: string, eventIndex: number, finality: Finality) {
    const event = this.events.get(`${signature}:${eventIndex}`);
    if (event && finalityRank[finality] > finalityRank[event.finality]) event.finality = finality;
  }
  async listUnbatchedFinalized(tokenMint: string, side: TradeSide) {
    return [...this.events.values()].filter((event) => event.mint === tokenMint && event.side === side && event.finality === "FINALIZED" && !event.batchId);
  }
  async getOldestUnbatchedAt(tokenMint: string, side: TradeSide) {
    const dates = [...this.events.values()].filter((event) => event.mint === tokenMint && event.side === side && event.finality === "FINALIZED" && !event.batchId).map((event) => event.blockTime ?? new Date());
    return dates.length ? new Date(Math.min(...dates.map(Number))) : null;
  }
  async createBatch(batch: FeeBatchRecord) {
    if (this.batches.has(batch.id)) throw new Error("Duplicate batch id");
    for (const id of batch.eventIds) {
      const event = this.events.get(id);
      if (!event || event.batchId || event.finality !== "FINALIZED") throw new Error("Event is not batchable");
    }
    this.batches.set(batch.id, structuredClone(batch));
    for (const id of batch.eventIds) this.events.get(id)!.batchId = batch.id;
  }
  async transitionBatch(id: string, from: BatchStatus[], to: BatchStatus, error?: string) {
    const batch = this.batches.get(id);
    if (!batch || !from.includes(batch.status)) return false;
    batch.status = to;
    batch.lastError = error;
    return true;
  }
}
