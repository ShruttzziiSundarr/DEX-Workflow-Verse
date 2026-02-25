/** Utility helpers for the Lightning (Instant SOL Transfer) module */

/** Convert SOL to lamports */
export function solToLamports(sol: string | number): number {
  return Math.floor(parseFloat(String(sol)) * 1_000_000_000);
}

/** Convert lamports to SOL string */
export function lamportsToSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(9);
}
