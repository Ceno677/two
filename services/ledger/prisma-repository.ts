import { Prisma, type BatchStatus as DbBatchStatus, type Finality as DbFinality } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import type { BatchStatus, Finality, TradeSide } from "@/lib/types";
import type { FeeBatchRecord, FeeConfiguration, FeeLedgerRepository, StoredFeeEvent } from "./types";

const db = () => getDb();
type ConfigRow = {
  tokenMint: string; canonicalPairMint: string; buyFeeAssetMint: string; sellFeeAssetMint: string;
  routingThresholdRaw: bigint; maxBatchIntervalSecs: number; maxSlippageBps: number;
  protocolShareBps: number; enabled: boolean;
  token: { id: string; pumpCreatorPda: string; pumpswapPool: string | null };
};

function configFrom(row: ConfigRow | null): FeeConfiguration | null {
  if (!row || !row.token) return null;
  return {
    tokenId: row.token.id, tokenMint: row.tokenMint, pumpCreatorPda: row.token.pumpCreatorPda,
    canonicalPairMint: row.canonicalPairMint, buyFeeAssetMint: row.buyFeeAssetMint,
    sellFeeAssetMint: row.sellFeeAssetMint, routingThresholdRaw: row.routingThresholdRaw,
    maxBatchIntervalMs: row.maxBatchIntervalSecs * 1000, maxSlippageBps: row.maxSlippageBps,
    protocolShareBps: row.protocolShareBps, enabled: row.enabled,
  };
}

export class PrismaFeeLedgerRepository implements FeeLedgerRepository {
  async getConfigByMint(mint: string) {
    const row = await db().directionalFeeConfig.findUnique({ where: { tokenMint: mint }, include: { token: true } });
    return configFrom(row);
  }

  async getConfigByPool(pool: string) {
    const token = await db().token.findFirst({ where: { pumpswapPool: pool }, include: { config: true } });
    return token?.config ? configFrom({ ...token.config, token }) : null;
  }

  async insertEvent(event: StoredFeeEvent) {
    const config = await this.getConfigByMint(event.mint);
    if (!config) return "DUPLICATE" as const;
    try {
      await db().feeEvent.create({ data: {
        id: event.id, tokenId: config.tokenId, tokenMint: event.mint,
        tradeSignature: event.signature, eventIndex: event.eventIndex, slot: event.slot,
        finality: event.finality, tradeSide: event.side, rawFeeAsset: event.quoteMint,
        rawFeeAmount: event.feeAmount, destinationAsset: event.destinationAsset,
        status: event.finality, blockTime: event.blockTime,
        finalizedAt: event.finality === "FINALIZED" ? new Date() : null,
      } });
      return "INSERTED" as const;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "DUPLICATE" as const;
      throw error;
    }
  }

  async updateEventFinality(signature: string, eventIndex: number, finality: Finality) {
    const allowed: Record<Finality, DbFinality[]> = { OBSERVED: [], CONFIRMED: ["OBSERVED"], FINALIZED: ["OBSERVED", "CONFIRMED"] };
    if (!allowed[finality].length) return;
    await db().feeEvent.updateMany({
      where: { tradeSignature: signature, eventIndex, finality: { in: allowed[finality] } },
      data: { finality, status: finality, finalizedAt: finality === "FINALIZED" ? new Date() : undefined },
    });
  }

  async listUnbatchedFinalized(tokenMint: string, side: TradeSide): Promise<StoredFeeEvent[]> {
    const rows = await db().feeEvent.findMany({ where: { tokenMint, tradeSide: side, finality: "FINALIZED", batchId: null }, orderBy: [{ slot: "asc" }, { eventIndex: "asc" }] });
    return rows.map((row) => ({
      id: row.id, signature: row.tradeSignature, eventIndex: row.eventIndex, slot: row.slot,
      mint: row.tokenMint, creator: "", side: row.tradeSide, feeAmount: row.rawFeeAmount,
      quoteMint: row.rawFeeAsset, venue: "PUMP_BONDING_CURVE", blockTime: row.blockTime,
      finality: row.finality, destinationAsset: row.destinationAsset, batchId: row.batchId ?? undefined,
    }));
  }

  async getOldestUnbatchedAt(tokenMint: string, side: TradeSide) {
    const row = await db().feeEvent.findFirst({ where: { tokenMint, tradeSide: side, finality: "FINALIZED", batchId: null }, orderBy: { blockTime: "asc" }, select: { blockTime: true, createdAt: true } });
    return row ? row.blockTime ?? row.createdAt : null;
  }

  async createBatch(batch: FeeBatchRecord) {
    await db().$transaction(async (tx) => {
      const token = await tx.token.findUniqueOrThrow({ where: { mint: batch.tokenMint }, select: { id: true } });
      await tx.feeBatch.create({ data: {
        id: batch.id, tokenId: token.id, tokenMint: batch.tokenMint, side: batch.side,
        rawAmount: batch.rawAmount, protocolFeeAmount: batch.protocolFeeAmount,
        routableAmount: batch.routableAmount, inputAsset: batch.inputAsset,
        outputAsset: batch.outputAsset, status: batch.status, createdAt: batch.createdAt,
      } });
      const claimed = await tx.feeEvent.updateMany({ where: { id: { in: batch.eventIds }, batchId: null, finality: "FINALIZED" }, data: { batchId: batch.id, status: "BATCHED" } });
      if (claimed.count !== batch.eventIds.length) throw new Error("Concurrent batch claim detected");
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async transitionBatch(id: string, from: BatchStatus[], to: BatchStatus, error?: string) {
    const result = await db().feeBatch.updateMany({ where: { id, status: { in: from as DbBatchStatus[] } }, data: { status: to as DbBatchStatus, lastError: error } });
    return result.count === 1;
  }
}
