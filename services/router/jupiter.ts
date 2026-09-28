import { Connection } from "@solana/web3.js";
import type { RouteQuote } from "@/lib/types";
import type { BuiltRoute, FeeRouter, QuoteRequest, RouteStatus, RouterInstruction } from "./types";
import { RouteUnavailableError, StaleQuoteError } from "./types";

interface JupiterQuoteResponse {
  inputMint: string; outputMint: string; inAmount: string; outAmount: string;
  otherAmountThreshold: string; priceImpactPct: string; error?: string;
}

export class JupiterAdapter implements FeeRouter {
  readonly provider = "JUPITER" as const;
  private readonly baseUrl = process.env.JUPITER_API_URL ?? "https://lite-api.jup.ag/swap/v1";
  constructor(private readonly connection: Connection) {}

  private headers(): HeadersInit {
    return process.env.JUPITER_API_KEY ? { "x-api-key": process.env.JUPITER_API_KEY } : {};
  }

  async getQuote(request: QuoteRequest): Promise<RouteQuote> {
    if (request.amount <= 0n) throw new RouteUnavailableError("Amount must be positive");
    if (request.slippageBps < 1 || request.slippageBps > 500) throw new RouteUnavailableError("Slippage must be between 1 and 500 bps");
    const url = new URL(`${this.baseUrl}/quote`);
    url.searchParams.set("inputMint", request.inputMint);
    url.searchParams.set("outputMint", request.outputMint);
    url.searchParams.set("amount", request.amount.toString());
    url.searchParams.set("slippageBps", request.slippageBps.toString());
    url.searchParams.set("restrictIntermediateTokens", "true");
    const response = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new RouteUnavailableError(`Jupiter quote failed with HTTP ${response.status}`);
    const raw = await response.json() as JupiterQuoteResponse;
    if (raw.error || !raw.outAmount || !raw.otherAmountThreshold) throw new RouteUnavailableError(raw.error ?? "Jupiter returned no route");
    return {
      provider: "JUPITER", inputMint: raw.inputMint, outputMint: raw.outputMint,
      inputAmount: BigInt(raw.inAmount), expectedOutput: BigInt(raw.outAmount),
      minimumOutput: BigInt(raw.otherAmountThreshold), priceImpactPct: raw.priceImpactPct,
      expiresAt: new Date(Date.now() + 20_000), raw,
    };
  }

  async buildRoute(quote: RouteQuote, authority: string, destination: string, payer = authority): Promise<BuiltRoute> {
    if (quote.expiresAt.getTime() <= Date.now()) throw new StaleQuoteError("Quote expired before route construction");
    const response = await fetch(`${this.baseUrl}/swap-instructions`, {
      method: "POST", headers: { "content-type": "application/json", ...this.headers() },
      body: JSON.stringify({
        quoteResponse: quote.raw,
        userPublicKey: authority,
        payer,
        destinationTokenAccount: destination,
        wrapAndUnwrapSol: false,
        useSharedAccounts: true,
        dynamicComputeUnitLimit: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new RouteUnavailableError(`Jupiter route build failed with HTTP ${response.status}`);
    const raw = await response.json() as {
      computeBudgetInstructions?: RouterInstruction[];
      setupInstructions?: RouterInstruction[];
      swapInstruction?: RouterInstruction;
      cleanupInstruction?: RouterInstruction | null;
      addressLookupTableAddresses?: string[];
      error?: string;
    };
    if (!raw.swapInstruction) throw new RouteUnavailableError(raw.error ?? "Jupiter returned no swap instruction");
    return {
      provider: "JUPITER",
      computeBudgetInstructions: raw.computeBudgetInstructions ?? [],
      setupInstructions: raw.setupInstructions ?? [],
      swapInstruction: raw.swapInstruction,
      cleanupInstruction: raw.cleanupInstruction ?? null,
      addressLookupTableAddresses: raw.addressLookupTableAddresses ?? [],
      raw,
    };
  }

  async getRouteStatus(signature: string): Promise<RouteStatus> {
    const result = await this.connection.getSignatureStatus(signature, { searchTransactionHistory: true });
    if (!result.value) return { state: "PENDING", signature };
    if (result.value.err) return { state: "FAILED", signature };
    return { state: result.value.confirmationStatus === "finalized" ? "CONFIRMED" : "PENDING", signature };
  }
}
