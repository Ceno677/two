import type { RouteQuote } from "@/lib/types";

export interface QuoteRequest { inputMint: string; outputMint: string; amount: bigint; slippageBps: number; }
export interface RouterInstructionAccount { pubkey: string; isSigner: boolean; isWritable: boolean; }
export interface RouterInstruction { programId: string; accounts: RouterInstructionAccount[]; data: string; }
export interface BuiltRoute {
  provider: "JUPITER" | "NEAR_INTENTS";
  serializedTransaction?: string;
  depositAddress?: string;
  computeBudgetInstructions?: RouterInstruction[];
  setupInstructions?: RouterInstruction[];
  swapInstruction?: RouterInstruction;
  cleanupInstruction?: RouterInstruction | null;
  addressLookupTableAddresses?: string[];
  raw: unknown;
}
export interface RouteStatus { state: "PENDING" | "CONFIRMED" | "FAILED" | "REFUNDED"; outputAmount?: bigint; signature?: string; }

export interface FeeRouter {
  readonly provider: "JUPITER" | "NEAR_INTENTS";
  getQuote(request: QuoteRequest): Promise<RouteQuote>;
  buildRoute(quote: RouteQuote, authority: string, destination: string, payer?: string): Promise<BuiltRoute>;
  getRouteStatus(reference: string): Promise<RouteStatus>;
}

export class RouteUnavailableError extends Error { readonly code = "ROUTE_UNAVAILABLE"; }
export class StaleQuoteError extends Error { readonly code = "STALE_QUOTE"; }
