import { NextResponse } from "next/server";

export async function POST() {
  if (!process.env.DIRECTIONAL_FEE_PROGRAM_ID) {
    return NextResponse.json({
      code: "DIRECTIONAL_PROGRAM_NOT_DEPLOYED",
      message: "Launch construction is disabled until the audited vault program is deployed. No placeholder transaction was returned.",
    }, { status: 503 });
  }
  return NextResponse.json({
    code: "CANARY_NOT_VERIFIED",
    message: "Production launch remains gated until both BUY and SELL creator-fee canary transactions settle onchain.",
  }, { status: 503 });
}
