import { createHash } from "node:crypto";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import type { RouterInstruction } from "@/services/router/types";

const CONFIG_SEED = Buffer.from("directional-fee");

function discriminator(name: string) {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function accountDiscriminator(name: string) {
  return createHash("sha256").update(`account:${name}`).digest().subarray(0, 8);
}

function u64(value: bigint) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(value);
  return bytes;
}

function u32(value: number) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
}

function u16(value: number) {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16LE(value);
  return bytes;
}

export function directionalConfigPda(programId: PublicKey, tokenMint: PublicKey) {
  return PublicKey.findProgramAddressSync([CONFIG_SEED, tokenMint.toBuffer()], programId)[0];
}

export function routeReceiptPda(programId: PublicKey, config: PublicKey, batchId: Uint8Array) {
  if (batchId.length !== 32) throw new Error("Batch id must be 32 bytes");
  return PublicKey.findProgramAddressSync([
    Buffer.from("route-receipt"),
    config.toBuffer(),
    Buffer.from(batchId),
  ], programId)[0];
}

export interface DirectionalConfigAccount {
  tokenMint: PublicKey;
  authority: PublicKey;
  routeAuthority: PublicKey;
  canonicalPairMint: PublicKey;
  buyFeeAssetMint: PublicKey;
  sellFeeAssetMint: PublicKey;
  buyDestination: PublicKey;
  sellDestination: PublicKey;
  routingThresholdRaw: bigint;
  maxBatchIntervalSeconds: number;
  protocolShareBps: number;
  maxSlippageBps: number;
  buyRoutedRaw: bigint;
  sellRoutedRaw: bigint;
  enabled: boolean;
  paused: boolean;
  bump: number;
}

export function decodeDirectionalConfig(data: Buffer): DirectionalConfigAccount {
  if (data.length < 299 || !data.subarray(0, 8).equals(accountDiscriminator("DirectionalFeeConfig"))) {
    throw new Error("Invalid directional fee config account");
  }
  let offset = 8;
  const key = () => {
    const value = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    return value;
  };
  const tokenMint = key();
  const authority = key();
  const routeAuthority = key();
  const canonicalPairMint = key();
  const buyFeeAssetMint = key();
  const sellFeeAssetMint = key();
  const buyDestination = key();
  const sellDestination = key();
  const routingThresholdRaw = data.readBigUInt64LE(offset); offset += 8;
  const maxBatchIntervalSeconds = data.readUInt32LE(offset); offset += 4;
  const protocolShareBps = data.readUInt16LE(offset); offset += 2;
  const maxSlippageBps = data.readUInt16LE(offset); offset += 2;
  const buyRoutedRaw = data.readBigUInt64LE(offset); offset += 8;
  const sellRoutedRaw = data.readBigUInt64LE(offset); offset += 8;
  const enabled = data[offset++] !== 0;
  const paused = data[offset++] !== 0;
  const bump = data[offset];
  return {
    tokenMint, authority, routeAuthority, canonicalPairMint, buyFeeAssetMint,
    sellFeeAssetMint, buyDestination, sellDestination, routingThresholdRaw,
    maxBatchIntervalSeconds, protocolShareBps, maxSlippageBps, buyRoutedRaw,
    sellRoutedRaw, enabled, paused, bump,
  };
}

export function executeDirectionalRouteInstruction(args: {
  programId: PublicKey;
  config: PublicKey;
  routeAuthority: PublicKey;
  inputVault: PublicKey;
  outputVault: PublicKey;
  tokenProgram: PublicKey;
  batchId: Uint8Array;
  side: "BUY" | "SELL";
  amountIn: bigint;
  minimumOutput: bigint;
  expirySlot: bigint;
  jupiterSwapInstruction: RouterInstruction;
}) {
  const jupiterProgram = new PublicKey(args.jupiterSwapInstruction.programId);
  const receipt = routeReceiptPda(args.programId, args.config, args.batchId);
  const swapData = Buffer.from(args.jupiterSwapInstruction.data, "base64");
  const vectorLength = Buffer.alloc(4);
  vectorLength.writeUInt32LE(swapData.length);
  const data = Buffer.concat([
    discriminator("execute_route"),
    Buffer.from(args.batchId),
    Buffer.from([args.side === "BUY" ? 0 : 1]),
    u64(args.amountIn),
    u64(args.minimumOutput),
    u64(args.expirySlot),
    vectorLength,
    swapData,
  ]);
  const remaining = args.jupiterSwapInstruction.accounts.map((account) => ({
    pubkey: new PublicKey(account.pubkey),
    // The config PDA signs only inside the program CPI. Marking it as an
    // outer signer would make the wallet transaction impossible to sign.
    isSigner: false,
    isWritable: account.isWritable,
  }));

  return {
    receipt,
    instruction: new TransactionInstruction({
      programId: args.programId,
      keys: [
        { pubkey: args.config, isSigner: false, isWritable: true },
        { pubkey: args.routeAuthority, isSigner: true, isWritable: true },
        { pubkey: args.inputVault, isSigner: false, isWritable: true },
        { pubkey: args.outputVault, isSigner: false, isWritable: true },
        { pubkey: jupiterProgram, isSigner: false, isWritable: false },
        { pubkey: receipt, isSigner: false, isWritable: true },
        { pubkey: args.tokenProgram, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ...remaining,
      ],
      data,
    }),
  };
}

export function initializeDirectionalConfigInstruction(args: {
  programId: PublicKey;
  authority: PublicKey;
  tokenMint: PublicKey;
  routeAuthority: PublicKey;
  canonicalPairMint: PublicKey;
  buyFeeAssetMint: PublicKey;
  sellFeeAssetMint: PublicKey;
  buyDestination: PublicKey;
  sellDestination: PublicKey;
  routingThresholdRaw: bigint;
  maxBatchIntervalSeconds: number;
  protocolShareBps: number;
  maxSlippageBps: number;
}) {
  const config = directionalConfigPda(args.programId, args.tokenMint);
  const data = Buffer.concat([
    discriminator("initialize_config"),
    args.routeAuthority.toBuffer(),
    args.canonicalPairMint.toBuffer(),
    args.buyFeeAssetMint.toBuffer(),
    args.sellFeeAssetMint.toBuffer(),
    args.buyDestination.toBuffer(),
    args.sellDestination.toBuffer(),
    u64(args.routingThresholdRaw),
    u32(args.maxBatchIntervalSeconds),
    u16(args.protocolShareBps),
    u16(args.maxSlippageBps),
  ]);

  return {
    config,
    instruction: new TransactionInstruction({
      programId: args.programId,
      keys: [
        { pubkey: args.authority, isSigner: true, isWritable: true },
        { pubkey: args.tokenMint, isSigner: false, isWritable: false },
        { pubkey: config, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    }),
  };
}
