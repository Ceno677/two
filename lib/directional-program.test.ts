import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { Keypair, SystemProgram } from "@solana/web3.js";
import {
  directionalConfigPda,
  decodeDirectionalConfig,
  executeDirectionalRouteInstruction,
  initializeDirectionalConfigInstruction,
  routeReceiptPda,
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

  it("encodes a Jupiter CPI without requiring the config PDA to sign the outer transaction", () => {
    const keys = Array.from({ length: 8 }, () => Keypair.generate().publicKey);
    const [programId, config, authority, inputVault, outputVault, tokenProgram, jupiterProgram, market] = keys;
    const batchId = new Uint8Array(32).fill(7);
    const result = executeDirectionalRouteInstruction({
      programId,
      config,
      routeAuthority: authority,
      inputVault,
      outputVault,
      tokenProgram,
      batchId,
      side: "SELL",
      amountIn: 50_000_000n,
      minimumOutput: 12_000n,
      expirySlot: 999n,
      jupiterSwapInstruction: {
        programId: jupiterProgram.toBase58(),
        accounts: [
          { pubkey: config.toBase58(), isSigner: true, isWritable: true },
          { pubkey: market.toBase58(), isSigner: false, isWritable: false },
        ],
        data: Buffer.from([1, 2, 3]).toString("base64"),
      },
    });

    expect(result.receipt.equals(routeReceiptPda(programId, config, batchId))).toBe(true);
    expect(result.instruction.programId.equals(programId)).toBe(true);
    expect(result.instruction.keys).toHaveLength(10);
    expect(result.instruction.keys[0]).toMatchObject({ pubkey: config, isSigner: false, isWritable: true });
    expect(result.instruction.keys[1]).toMatchObject({ pubkey: authority, isSigner: true, isWritable: true });
    expect(result.instruction.keys[7]).toMatchObject({ pubkey: SystemProgram.programId, isSigner: false });
    expect(result.instruction.keys[8]).toMatchObject({ pubkey: config, isSigner: false, isWritable: true });
    expect(result.instruction.data).toHaveLength(72);
    expect(result.instruction.data[40]).toBe(1);
    expect(result.instruction.data.readBigUInt64LE(41)).toBe(50_000_000n);
    expect(result.instruction.data.readBigUInt64LE(49)).toBe(12_000n);
    expect(result.instruction.data.readBigUInt64LE(57)).toBe(999n);
    expect(result.instruction.data.readUInt32LE(65)).toBe(3);
  });

  it("decodes the deployed config layout including routed totals", () => {
    const keys = Array.from({ length: 8 }, () => Keypair.generate().publicKey);
    const data = Buffer.alloc(299);
    createHash("sha256").update("account:DirectionalFeeConfig").digest().subarray(0, 8).copy(data);
    keys.forEach((key, index) => key.toBuffer().copy(data, 8 + index * 32));
    data.writeBigUInt64LE(50_000_000n, 264);
    data.writeUInt32LE(1_800, 272);
    data.writeUInt16LE(0, 276);
    data.writeUInt16LE(100, 278);
    data.writeBigUInt64LE(12n, 280);
    data.writeBigUInt64LE(34n, 288);
    data[296] = 1;
    data[297] = 0;
    data[298] = 255;

    const decoded = decodeDirectionalConfig(data);
    expect(decoded.tokenMint.equals(keys[0])).toBe(true);
    expect(decoded.sellDestination.equals(keys[7])).toBe(true);
    expect(decoded.routingThresholdRaw).toBe(50_000_000n);
    expect(decoded.maxBatchIntervalSeconds).toBe(1_800);
    expect(decoded.maxSlippageBps).toBe(100);
    expect(decoded.buyRoutedRaw).toBe(12n);
    expect(decoded.sellRoutedRaw).toBe(34n);
    expect(decoded.enabled).toBe(true);
    expect(decoded.paused).toBe(false);
    expect(decoded.bump).toBe(255);
  });
});
