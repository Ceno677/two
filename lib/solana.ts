import { Connection } from "@solana/web3.js";
import { env } from "./env";

let connection: Connection | undefined;
export const getConnection = () => connection ??= new Connection(env.SOLANA_RPC_URL, { commitment: "finalized", confirmTransactionInitialTimeout: 30_000 });
