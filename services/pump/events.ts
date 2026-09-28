import { PUMP_AMM_PROGRAM_ID, PUMP_PROGRAM_ID, PumpSdk } from "@pump-fun/pump-sdk";

export interface ParsedCreatorFeeEvent {
  eventIndex: number;
  venue: "PUMP_BONDING_CURVE" | "PUMPSWAP";
  side: "BUY" | "SELL";
  mint?: string;
  pool?: string;
  creator: string;
  quoteMint?: string;
  feeAmount: bigint;
  timestamp: number;
}

const sdk = new PumpSdk();
const invokePattern = /^Program ([1-9A-HJ-NP-Za-km-z]{32,44}) invoke \[\d+\]$/;
const exitPattern = /^Program ([1-9A-HJ-NP-Za-km-z]{32,44}) (?:success|failed:)/;

/**
 * Decodes only official Pump Anchor events. Unknown `Program data` records are
 * ignored; no direction is inferred from balances, prices, or text logs.
 */
export function parseCreatorFeeEvents(logs: readonly string[]): ParsedCreatorFeeEvent[] {
  const stack: string[] = [];
  const events: ParsedCreatorFeeEvent[] = [];
  let eventIndex = 0;

  for (const log of logs) {
    const invoke = invokePattern.exec(log);
    if (invoke) {
      stack.push(invoke[1]);
      continue;
    }

    const exit = exitPattern.exec(log);
    if (exit) {
      const index = stack.lastIndexOf(exit[1]);
      if (index >= 0) stack.splice(index, 1);
      continue;
    }

    if (!log.startsWith("Program data: ")) continue;
    const owner = stack.at(-1);
    const data = Buffer.from(log.slice("Program data: ".length), "base64");

    if (owner === PUMP_PROGRAM_ID.toBase58()) {
      try {
        const decoded = sdk.decodeTradeEventBc(data);
        if (decoded.creatorFee.isZero()) continue;
        events.push({
          eventIndex: eventIndex++,
          venue: "PUMP_BONDING_CURVE",
          side: decoded.isBuy ? "BUY" : "SELL",
          mint: decoded.mint.toBase58(),
          creator: decoded.creator.toBase58(),
          quoteMint: decoded.quoteMint.toBase58(),
          feeAmount: BigInt(decoded.creatorFee.toString()),
          timestamp: decoded.timestamp.toNumber(),
        });
      } catch {
        // Another Pump event discriminator; deliberately ignored.
      }
      continue;
    }

    if (owner === PUMP_AMM_PROGRAM_ID.toBase58()) {
      try {
        const decoded = sdk.decodeBuyEventAmm(data);
        if (decoded.coinCreatorFee.isZero()) continue;
        events.push({
          eventIndex: eventIndex++, venue: "PUMPSWAP", side: "BUY",
          pool: decoded.pool.toBase58(), creator: decoded.coinCreator.toBase58(),
          feeAmount: BigInt(decoded.coinCreatorFee.toString()), timestamp: decoded.timestamp.toNumber(),
        });
      } catch {
        try {
          const decoded = sdk.decodeSellEventAmm(data);
          if (decoded.coinCreatorFee.isZero()) continue;
          events.push({
            eventIndex: eventIndex++, venue: "PUMPSWAP", side: "SELL",
            pool: decoded.pool.toBase58(), creator: decoded.coinCreator.toBase58(),
            feeAmount: BigInt(decoded.coinCreatorFee.toString()), timestamp: decoded.timestamp.toNumber(),
          });
        } catch {
          // Another PumpSwap event discriminator; deliberately ignored.
        }
      }
    }
  }

  return events;
}
