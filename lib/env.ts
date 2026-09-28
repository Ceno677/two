import { z } from "zod";

const schema = z.object({
  SOLANA_RPC_URL: z.url().default("https://api.mainnet-beta.solana.com"),
  INTERNAL_ROUTE_SECRET: z.string().min(32).optional(),
  DIRECTIONAL_FEE_PROGRAM_ID: z.string().optional(),
  DEFAULT_MAX_SLIPPAGE_BPS: z.coerce.number().int().min(1).max(500).default(100),
});

export const env = schema.parse({
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL,
  INTERNAL_ROUTE_SECRET: process.env.INTERNAL_ROUTE_SECRET,
  DIRECTIONAL_FEE_PROGRAM_ID: process.env.DIRECTIONAL_FEE_PROGRAM_ID,
  DEFAULT_MAX_SLIPPAGE_BPS: process.env.DEFAULT_MAX_SLIPPAGE_BPS,
});
