import { PublicKey } from "@solana/web3.js";
import { getConnection } from "./solana";

export type DirectionalProgramStatus =
  | { ready: true; programId: PublicKey }
  | { ready: false; code: "PROGRAM_ID_MISSING" | "PROGRAM_ID_INVALID" | "PROGRAM_NOT_DEPLOYED" };

export async function getDirectionalProgramStatus(): Promise<DirectionalProgramStatus> {
  const value = process.env.DIRECTIONAL_FEE_PROGRAM_ID;
  if (!value) return { ready: false, code: "PROGRAM_ID_MISSING" };

  let programId: PublicKey;
  try {
    programId = new PublicKey(value);
  } catch {
    return { ready: false, code: "PROGRAM_ID_INVALID" };
  }

  const account = await getConnection().getAccountInfo(programId, "confirmed");
  if (!account?.executable) return { ready: false, code: "PROGRAM_NOT_DEPLOYED" };
  return { ready: true, programId };
}
