import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function authorized(request: Request) {
  const secret = process.env.INTERNAL_ROUTE_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || !supplied) return false;
  const left = Buffer.from(secret); const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  if (!process.env.DIRECTIONAL_FEE_PROGRAM_ID) return NextResponse.json({
    code: "ROUTING_EXECUTION_DISABLED",
    message: "Raw fees remain in the creator PDA until an audited route executor is deployed.",
  }, { status: 503 });
  return NextResponse.json({
    code: "USE_TOKEN_ROUTE_ENDPOINT",
    message: "Fee conversions are built per token and side at /api/token/:mint/route.",
  }, { status: 410 });
}
