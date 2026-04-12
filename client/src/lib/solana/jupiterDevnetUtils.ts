/**
 * Jupiter Devnet Utilities
 * Provides mock token lists and utilities for devnet testing
 */

import { DEVNET_SAFE_MINTS, getDevnetSafeTokens } from './devnetValidator';

// ─── Live price feed ──────────────────────────────────────────────────────────

const JUP_PRICE_URL = 'https://price.jup.ag/v4/price';
const PRICE_CACHE_TTL = 60_000; // 60 s

// Devnet mint → mainnet mint (Jupiter price API uses mainnet addresses)
const DEVNET_TO_MAINNET: Record<string, string> = {
  'So11111111111111111111111111111111111111112':  'So11111111111111111111111111111111111111112',  // SOL
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',  // USDT
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
};

// mainnet mint → { price, fetchedAt }
const priceCache: Record<string, { price: number; fetchedAt: number }> = {};

/**
 * Fetch live USD prices for all supported tokens from Jupiter Price API v4.
 * Results are cached for 60 s; stale entries are refreshed in bulk.
 * Falls back silently — callers should handle a zero/undefined return.
 */
export async function fetchLivePrices(): Promise<Record<string, number>> {
  const now = Date.now();
  const mainnetMints = Object.values(DEVNET_TO_MAINNET);
  const stale = mainnetMints.some(m => !priceCache[m] || now - priceCache[m].fetchedAt >= PRICE_CACHE_TTL);

  if (!stale) {
    return Object.fromEntries(mainnetMints.map(m => [m, priceCache[m].price]));
  }

  const ids = mainnetMints.join(',');
  const res = await fetch(`${JUP_PRICE_URL}?ids=${ids}`);
  if (!res.ok) throw new Error(`Jupiter price API ${res.status}`);

  const json = await res.json();
  const out: Record<string, number> = {};
  for (const [mint, data] of Object.entries(json.data ?? {})) {
    const price = (data as any).price as number;
    out[mint] = price;
    priceCache[mint] = { price, fetchedAt: now };
  }
  return out;
}

/**
 * Get the live USD price for a devnet token mint.
 * Falls back to the hardcoded MOCK_PRICES table if the API is unreachable.
 */
export async function getDevnetTokenPriceLive(devnetMint: string): Promise<number> {
  const mainnetMint = DEVNET_TO_MAINNET[devnetMint];
  if (!mainnetMint) return MOCK_PRICES[devnetMint] ?? 0;
  try {
    const prices = await fetchLivePrices();
    return prices[mainnetMint] ?? MOCK_PRICES[devnetMint] ?? 0;
  } catch {
    return MOCK_PRICES[devnetMint] ?? 0;
  }
}

/**
 * Compute the live exchange rate between two devnet token mints.
 * Falls back to the hardcoded rate if the price API is unreachable.
 */
export async function getDevnetExchangeRateLive(inputMint: string, outputMint: string): Promise<number> {
  const [inputPrice, outputPrice] = await Promise.all([
    getDevnetTokenPriceLive(inputMint),
    getDevnetTokenPriceLive(outputMint),
  ]);
  if (!inputPrice || !outputPrice) return 0;
  return inputPrice / outputPrice;
}

export interface JupiterToken {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  logoURI?: string;
  tags?: string[];
}

// Mock token list for devnet (Jupiter doesn't fully work on devnet)
const DEVNET_TOKEN_LIST: JupiterToken[] = [
  {
    address: "So11111111111111111111111111111111111111112",
    chainId: 103, // Devnet chain ID
    decimals: 9,
    name: "Wrapped SOL",
    symbol: "SOL",
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    tags: ["native", "devnet"],
  },
  {
    address: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    chainId: 103,
    decimals: 6,
    name: "USD Coin (Devnet)",
    symbol: "USDC",
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    tags: ["stablecoin", "devnet"],
  },
  {
    address: "EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS",
    chainId: 103,
    decimals: 6,
    name: "Tether USD (Devnet)",
    symbol: "USDT",
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png",
    tags: ["stablecoin", "devnet"],
  },
  {
    address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    chainId: 103,
    decimals: 5,
    name: "Bonk (Devnet)",
    symbol: "BONK",
    logoURI: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
    tags: ["memecoin", "devnet"],
  },
];

// Mock price data (SOL-based pricing)
const MOCK_PRICES: Record<string, number> = {
  "So11111111111111111111111111111111111111112": 150.00,    // SOL in USD
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": 1.00,     // USDC
  "EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS": 1.00,     // USDT
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": 0.00001,  // BONK
};

/**
 * Get tradable tokens for devnet
 */
export function getDevnetTradableTokens(): JupiterToken[] {
  return [...DEVNET_TOKEN_LIST];
}

/**
 * Get token by address
 */
export function getDevnetTokenByAddress(address: string): JupiterToken | null {
  return DEVNET_TOKEN_LIST.find(token => token.address === address) || null;
}

/**
 * Get token by symbol
 */
export function getDevnetTokenBySymbol(symbol: string): JupiterToken | null {
  return DEVNET_TOKEN_LIST.find(
    token => token.symbol.toUpperCase() === symbol.toUpperCase()
  ) || null;
}

/**
 * Get mock price for a token in USD
 */
export function getDevnetTokenPrice(mintAddress: string): number {
  return MOCK_PRICES[mintAddress] || 0;
}

/**
 * Calculate mock exchange rate between two tokens
 */
export function getDevnetExchangeRate(inputMint: string, outputMint: string): number {
  const inputPrice = MOCK_PRICES[inputMint];
  const outputPrice = MOCK_PRICES[outputMint];

  if (!inputPrice || !outputPrice) {
    return 0;
  }

  return inputPrice / outputPrice;
}

/**
 * Get all available trading pairs on devnet (mock)
 */
export function getDevnetTradingPairs(): Array<{ inputMint: string; outputMint: string; inputSymbol: string; outputSymbol: string }> {
  const tokens = DEVNET_TOKEN_LIST;
  const pairs: Array<{ inputMint: string; outputMint: string; inputSymbol: string; outputSymbol: string }> = [];

  for (const input of tokens) {
    for (const output of tokens) {
      if (input.address !== output.address) {
        pairs.push({
          inputMint: input.address,
          outputMint: output.address,
          inputSymbol: input.symbol,
          outputSymbol: output.symbol,
        });
      }
    }
  }

  return pairs;
}

/**
 * Check if a trading pair is available on devnet
 */
export function isDevnetPairAvailable(inputMint: string, outputMint: string): boolean {
  const hasInput = DEVNET_TOKEN_LIST.some(t => t.address === inputMint);
  const hasOutput = DEVNET_TOKEN_LIST.some(t => t.address === outputMint);
  return hasInput && hasOutput && inputMint !== outputMint;
}
