import { NextResponse } from "next/server";
import { z } from "zod";
import { getConnection } from "@/lib/solana";

export const runtime = "nodejs";

const requestSchema = z.object({
  transaction: z.string().min(1),
  blockhash: z.string().min(1),
  lastValidBlockHeight: z.number().int().positive(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_TRANSACTION" }, { status: 400 });

  try {
    const raw = Buffer.from(parsed.data.transaction, "base64");
    if (raw.length === 0 || raw.length > 1_232) {
      return NextResponse.json({ code: "INVALID_TRANSACTION_SIZE" }, { status: 400 });
    }
    const connection = getConnection();
    const signature = await connection.sendRawTransaction(raw, {
      maxRetries: 8,
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: parsed.data.blockhash,
      lastValidBlockHeight: parsed.data.lastValidBlockHeight,
    }, "confirmed");
    if (confirmation.value.err) throw new Error(`Solana rejected the transaction: ${JSON.stringify(confirmation.value.err)}`);
    return NextResponse.json({ signature, explorer: `https://solscan.io/tx/${signature}` });
  } catch (error) {
    return NextResponse.json({
      code: "TRANSACTION_SUBMISSION_FAILED",
      message: error instanceof Error ? error.message : "Transaction submission failed",
    }, { status: 502 });
  }
}
