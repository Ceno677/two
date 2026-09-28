import { Connection } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { DirectionalFeeEngine, FeeIntegrityError } from "@/services/ledger/fee-engine";
import type { FeeLedgerRepository } from "@/services/ledger/types";
import { parseCreatorFeeEvents } from "@/services/pump/events";

export class PumpFeeKeeper {
  private readonly engine: DirectionalFeeEngine;
  constructor(private readonly connection: Connection, private readonly repo: FeeLedgerRepository) {
    this.engine = new DirectionalFeeEngine(repo);
  }

  /**
   * Processes a finalized transaction only. Replaying the same signature is
   * safe because the ledger uniqueness key is (signature, eventIndex).
   */
  async processFinalizedSignature(signature: string): Promise<{ inserted: number; duplicates: number }> {
    const transaction = await this.connection.getTransaction(signature, {
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    });
    if (!transaction?.meta || transaction.meta.err) return { inserted: 0, duplicates: 0 };

    const decoded = parseCreatorFeeEvents(transaction.meta.logMessages ?? []);
    let inserted = 0;
    let duplicates = 0;

    for (const event of decoded) {
      const config = event.mint
        ? await this.repo.getConfigByMint(event.mint)
        : event.pool ? await this.repo.getConfigByPool(event.pool) : null;
      if (!config) continue;
      const result = await this.engine.ingest({
        signature,
        eventIndex: event.eventIndex,
        slot: BigInt(transaction.slot),
        mint: config.tokenMint,
        creator: event.creator,
        side: event.side,
        feeAmount: event.feeAmount,
        quoteMint: event.quoteMint ?? config.canonicalPairMint ?? NATIVE_MINT.toBase58(),
        venue: event.venue,
        blockTime: transaction.blockTime ? new Date(transaction.blockTime * 1000) : null,
        finality: "FINALIZED",
      });
      if (result === "INSERTED") inserted++;
      if (result === "DUPLICATE") duplicates++;
    }
    return { inserted, duplicates };
  }

  async processWithRetry(signature: string, attempts = 3) {
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try { return await this.processFinalizedSignature(signature); }
      catch (error) {
        if (error instanceof FeeIntegrityError) throw error;
        lastError = error;
      }
    }
    throw lastError;
  }
}
