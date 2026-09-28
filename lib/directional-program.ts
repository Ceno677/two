import { createHash } from "node:crypto";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";

const CONFIG_SEED = Buffer.from("directional-fee");

function discriminator(name: string) {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
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
