import type { Asset, DirectionalFeeToken } from "@/lib/types";

export const ASSETS: Record<string, Asset> = {
  SOL: { symbol: "SOL", name: "Solana", chain: "solana", mint: "So11111111111111111111111111111111111111112", decimals: 9, accent: "#9d8cff" },
  USDC: { symbol: "USDC", name: "USD Coin", chain: "solana", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6, accent: "#4f8eff" },
  TSLAX: { symbol: "TSLAX", name: "Tesla xStock", chain: "solana", mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", decimals: 8, accent: "#f05b63" },
  SPYX: { symbol: "SPYX", name: "S&P 500 xStock", chain: "solana", mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", decimals: 8, accent: "#ddb456" },
  SPCX: { symbol: "SPCX", name: "SpaceX", chain: "solana", mint: "SPCXxcqXj6e5dJDVNovHN8744zkbhM2bYudU45BimGb", decimals: 8, accent: "#bec9d1" },
  NVDAX: { symbol: "NVDAX", name: "NVIDIA xStock", chain: "solana", mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", decimals: 8, accent: "#86bc52" },
  GOOGLX: { symbol: "GOOGLX", name: "Alphabet xStock", chain: "solana", mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN", decimals: 8, accent: "#64a1ff" },
  BTC: { symbol: "BTC", name: "Bitcoin", chain: "bitcoin", mint: "btc", decimals: 8, accent: "#f59f20" },
  ZEC: { symbol: "ZEC", name: "Zcash", chain: "zcash", mint: "zec", decimals: 8, accent: "#f2b638" },
};

export const TOKENS: DirectionalFeeToken[] = [
  { mint: "ELoN5oTYzXvECtor111111111111111111111111111", name: "Elon", symbol: "ELON", canonicalPair: ASSETS.SOL, buyFeeAsset: ASSETS.TSLAX, sellFeeAsset: ASSETS.SPCX, marketCap: 482100, volume24h: 128430, fees24h: 1605, buyFeesRaw: 12.84, sellFeesRaw: 8.62, buyAcquired: 4820, sellAcquired: 1936, progress: 72, holders: 1248, creator: "7zKp…3aF2", age: "18m" },
  { mint: "PRIV5oTYzXvECtor22222222222222222222222111", name: "Privacy", symbol: "PRIVACY", canonicalPair: ASSETS.SOL, buyFeeAsset: ASSETS.ZEC, sellFeeAsset: ASSETS.BTC, marketCap: 96200, volume24h: 53700, fees24h: 671, buyFeesRaw: 4.12, sellFeesRaw: 2.04, buyAcquired: 0, sellAcquired: 0, progress: 26, holders: 427, creator: "2Fma…9Ske", age: "7m" },
  { mint: "AI5oTYzXvECtor333333333333333333333333111", name: "Artificial", symbol: "AI", canonicalPair: ASSETS.SOL, buyFeeAsset: ASSETS.NVDAX, sellFeeAsset: ASSETS.GOOGLX, marketCap: 1920000, volume24h: 512800, fees24h: 6410, buyFeesRaw: 31.22, sellFeesRaw: 21.18, buyAcquired: 9321, sellAcquired: 5244, progress: 100, holders: 4331, creator: "8Nzq…1Ab7", age: "3h" },
];

export const formatUsd = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}m` : `$${Math.round(n / 1000)}k`;
