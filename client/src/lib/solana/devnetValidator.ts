/**
 * Devnet Token Validator
 * Validates whether tokens are safe to use on devnet for testing
 */

// Known devnet-safe token mints
export const DEVNET_SAFE_MINTS: Record<string, { symbol: string; decimals: number; name: string }> = {
  // Native SOL (wrapped)
  "So11111111111111111111111111111111111111112": { symbol: "SOL", decimals: 9, name: "Wrapped SOL" },
  // Devnet test USDC
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": { symbol: "USDC", decimals: 6, name: "USD Coin (Devnet)" },
  // Devnet test USDT
  "EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS": { symbol: "USDT", decimals: 6, name: "Tether USD (Devnet)" },
  // Common test tokens
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": { symbol: "BONK", decimals: 5, name: "Bonk (Devnet)" },
};

// Mainnet-only mints that should NOT be used on devnet
export const MAINNET_ONLY_MINTS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // Mainnet USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // Mainnet USDT
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",  // Marinade mSOL (mainnet)
  "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj", // stSOL (mainnet)
]);

/**
 * Check if a token mint is safe for devnet testing
 */
export function isDevnetSafeToken(mintAddress: string): boolean {
  // SOL is always safe
  if (mintAddress === "So11111111111111111111111111111111111111112") {
    return true;
  }

  // Check if it's a known devnet-safe mint
  if (DEVNET_SAFE_MINTS[mintAddress]) {
    return true;
  }

  // Reject known mainnet-only tokens
  if (MAINNET_ONLY_MINTS.has(mintAddress)) {
    return false;
  }

  // For unknown tokens, we're cautious - allow but warn
  return true;
}

/**
 * Validate a token pair for devnet trading
 */
export function validateDevnetTokenPair(inputMint: string, outputMint: string): {
  valid: boolean;
  reason?: string;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check input token
  if (MAINNET_ONLY_MINTS.has(inputMint)) {
    return {
      valid: false,
      reason: `Input token ${inputMint} is a mainnet-only token and cannot be used on devnet`,
      warnings,
    };
  }

  // Check output token
  if (MAINNET_ONLY_MINTS.has(outputMint)) {
    return {
      valid: false,
      reason: `Output token ${outputMint} is a mainnet-only token and cannot be used on devnet`,
      warnings,
    };
  }

  // Warn about unknown tokens
  if (!DEVNET_SAFE_MINTS[inputMint]) {
    warnings.push(`Input token ${inputMint} is not a known devnet token - proceed with caution`);
  }

  if (!DEVNET_SAFE_MINTS[outputMint]) {
    warnings.push(`Output token ${outputMint} is not a known devnet token - proceed with caution`);
  }

  return {
    valid: true,
    warnings,
  };
}

/**
 * Get token info for a devnet-safe mint
 */
export function getDevnetTokenInfo(mintAddress: string): { symbol: string; decimals: number; name: string } | null {
  return DEVNET_SAFE_MINTS[mintAddress] || null;
}

/**
 * Get all known devnet-safe tokens
 */
export function getDevnetSafeTokens(): Array<{ mint: string; symbol: string; decimals: number; name: string }> {
  return Object.entries(DEVNET_SAFE_MINTS).map(([mint, info]) => ({
    mint,
    ...info,
  }));
}
