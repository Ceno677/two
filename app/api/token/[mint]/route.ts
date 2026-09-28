import { NextResponse } from "next/server";
import { TOKENS } from "@/lib/data";

export async function GET(_: Request, { params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  const token = TOKENS.find((item) => item.mint === mint);
  if (!token) return NextResponse.json({ code: "TOKEN_NOT_INDEXED" }, { status: 404 });
  return NextResponse.json({ token, dataMode: "DEMONSTRATION_UNTIL_DATABASE_CONFIGURED" });
}
