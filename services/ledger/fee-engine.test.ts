import { describe, expect, it } from "vitest";
import { DirectionalFeeEngine, FeeIntegrityError } from "./fee-engine";
import { MemoryFeeLedgerRepository } from "./memory-repository";
import type { FeeConfiguration } from "./types";

const config: FeeConfiguration = {
  tokenId: "token-1", tokenMint: "ELON", pumpCreatorPda: "PDA", canonicalPairMint: "SOL",
  buyFeeAssetMint: "TSLAX", sellFeeAssetMint: "SPCX", routingThresholdRaw: 50n,
  maxBatchIntervalMs: 30 * 60 * 1000, maxSlippageBps: 100, protocolShareBps: 500, enabled: true,
};

const input = (side: "BUY" | "SELL", feeAmount: bigint, signature = `${side}-${feeAmount}`) => ({
  signature, eventIndex: 0, slot: 10n, mint: "ELON", creator: "PDA", side,
  feeAmount, quoteMint: "SOL", venue: "PUMP_BONDING_CURVE" as const,
  blockTime: new Date("2026-09-28T00:00:00Z"), finality: "FINALIZED" as const,
});

describe("DirectionalFeeEngine", () => {
  it("classifies BUY and SELL fees into independent destination assets", async () => {
    const repo = new MemoryFeeLedgerRepository(); repo.addConfig(config);
    const engine = new DirectionalFeeEngine(repo);
    await engine.ingest(input("BUY", 30n));
    await engine.ingest(input("SELL", 30n));
    expect([...repo.events.values()].find((e) => e.side === "BUY")?.destinationAsset).toBe("TSLAX");
    expect([...repo.events.values()].find((e) => e.side === "SELL")?.destinationAsset).toBe("SPCX");
  });

  it("ignores duplicate signature and event index", async () => {
    const repo = new MemoryFeeLedgerRepository(); repo.addConfig(config);
    const engine = new DirectionalFeeEngine(repo);
    expect(await engine.ingest(input("BUY", 30n, "same"))).toBe("INSERTED");
    expect(await engine.ingest(input("BUY", 30n, "same"))).toBe("DUPLICATE");
    expect(repo.events.size).toBe(1);
  });

  it("does not batch unfinalized events", async () => {
    const repo = new MemoryFeeLedgerRepository(); repo.addConfig(config);
    const engine = new DirectionalFeeEngine(repo);
    await engine.ingest({ ...input("BUY", 100n), finality: "CONFIRMED" });
    expect(await engine.prepareBatch(config, "BUY")).toBeNull();
  });

  it("batches multiple BUY fees and applies protocol share exactly once", async () => {
    const repo = new MemoryFeeLedgerRepository(); repo.addConfig(config);
    const engine = new DirectionalFeeEngine(repo);
    await engine.ingest(input("BUY", 20n, "a"));
    await engine.ingest(input("BUY", 40n, "b"));
    const batch = await engine.prepareBatch(config, "BUY");
    expect(batch).toMatchObject({ rawAmount: 60n, protocolFeeAmount: 3n, routableAmount: 57n, outputAsset: "TSLAX" });
    expect(await engine.prepareBatch(config, "BUY")).toBeNull();
  });

  it("keeps a failed route retryable without changing raw accounting", async () => {
    const repo = new MemoryFeeLedgerRepository(); repo.addConfig(config);
    const engine = new DirectionalFeeEngine(repo);
    await engine.ingest(input("SELL", 60n));
    const batch = await engine.prepareBatch(config, "SELL");
    expect(batch).not.toBeNull();
    await repo.transitionBatch(batch!.id, ["READY_TO_ROUTE"], "QUOTING");
    await engine.markRoutingFailure(batch!.id, "No live route");
    expect(repo.batches.get(batch!.id)).toMatchObject({ status: "RETRYABLE", rawAmount: 60n, outputAsset: "SPCX" });
  });

  it("rejects forged creator and quote mints", async () => {
    const repo = new MemoryFeeLedgerRepository(); repo.addConfig(config);
    const engine = new DirectionalFeeEngine(repo);
    await expect(engine.ingest({ ...input("BUY", 10n), creator: "ATTACKER" })).rejects.toBeInstanceOf(FeeIntegrityError);
    await expect(engine.ingest({ ...input("BUY", 10n), quoteMint: "FAKE" })).rejects.toBeInstanceOf(FeeIntegrityError);
  });
});
