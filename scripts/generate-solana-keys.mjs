import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { Keypair } from "@solana/web3.js";

const directory = new URL("../.keys/", import.meta.url);
const definitions = [
  ["directional_fees-keypair.json", "Program"],
  ["mainnet-deployer-keypair.json", "Deployer"],
];

mkdirSync(directory, { recursive: true });

for (const [filename, label] of definitions) {
  const target = new URL(filename, directory);
  if (existsSync(target)) {
    throw new Error(`${filename} already exists; refusing to overwrite key material`);
  }
  const keypair = Keypair.generate();
  writeFileSync(target, JSON.stringify(Array.from(keypair.secretKey)), {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  console.log(`${label} public key: ${keypair.publicKey.toBase58()}`);
}
