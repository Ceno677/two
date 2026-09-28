import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import {
  directionalConfigPda,
  initializeDirectionalConfigInstruction,
} from "./directional-program";

describe("directional program instruction encoder", () => {
  it("encodes the Anchor initializer and deterministic config PDA", () => {
    const keys = Array.from({ length: 9 }, () => Keypair.generate().publicKey);
    const [programId, authority, tokenMint, routeAuthority, pair, buy, sell, buyDestination, sellDestination] = keys;
    const expectedConfig = directionalConfigPda(programId, tokenMint);
    const { config, instruction } = initializeDirectionalConfigInstruction({
      programId,
      authority,
      tokenMint,
      routeAuthority,
      canonicalPairMint: pair,
      buyFeeAssetMint: buy,
      sellFeeAssetMint: sell,
      buyDestination,
      sellDestination,
      routingThresholdRaw: 50_000_000n,
      maxBatchIntervalSeconds: 1_800,
      protocolShareBps: 500,
      maxSlippageBps: 100,
    });

    expect(config.equals(expectedConfig)).toBe(true);
    expect(instruction.programId.equals(programId)).toBe(true);
    expect(instruction.keys).toHaveLength(4);
    expect(instruction.keys[0]).toMatchObject({ isSigner: true, isWritable: true });
    expect(instruction.keys[1]).toMatchObject({ isSigner: false, isWritable: false });
    expect(instruction.data).toHaveLength(216);
    expect(instruction.data.readBigUInt64LE(200)).toBe(50_000_000n);
    expect(instruction.data.readUInt32LE(208)).toBe(1_800);
    expect(instruction.data.readUInt16LE(212)).toBe(500);
    expect(instruction.data.readUInt16LE(214)).toBe(100);
  });
});
