/**
 * Claim Rewards Handler
 * Calculates and claims accrued LP fee rewards from liquidity pool positions.
 * On devnet: sends a real Solana transaction for confirmation, simulates reward math.
 * On mainnet: would call Raydium/Orca harvest instructions.
 */

import { PublicKey } from '@solana/web3.js';
import {
  claimPoolRewards,
  claimAllPoolRewards,
  getUserPositionsFromStorage,
  getAccruedRewards,
  type RewardResult,
} from './liquidityPool';

// Re-export for convenience
export type { RewardResult };

export interface ClaimParams {
  fromPubkey: PublicKey;
  poolAddress?: string;   // if omitted, claim from all pools
  autoReinvest?: boolean; // flag passed in from config (not yet auto-executed)
  fromPool?: string;      // token symbol like "SOL/USDC" (optional display hint)
}

export interface ClaimSummary {
  results: RewardResult[];
  totalRewardUSD: number;
  signature: string; // first tx signature (for history)
  message: string;
}

/**
 * Main claim rewards entry point called by WorkflowCanvas.
 * Finds the user's LP positions, calculates accrued fees, and claims them.
 */
export async function handleClaimRewards(params: ClaimParams): Promise<ClaimSummary> {
  const { fromPubkey, poolAddress } = params;

  let results: RewardResult[];

  if (poolAddress) {
    // Claim from a specific pool
    const result = await claimPoolRewards(fromPubkey, poolAddress);
    results = [result];
  } else {
    // Claim from all pools the wallet has active positions in
    results = await claimAllPoolRewards(fromPubkey);
  }

  const totalRewardUSD = results.reduce((sum, r) => sum + r.rewardUSD, 0);
  const signature = results[0].signature;

  const poolSummary = results
    .map(r => `${r.rewardA.toFixed(6)} ${r.tokenA} + ${r.rewardB.toFixed(4)} ${r.tokenB}`)
    .join(', ');

  return {
    results,
    totalRewardUSD,
    signature,
    message: `Claimed rewards: ${poolSummary} ($${totalRewardUSD.toFixed(4)} USD total)`,
  };
}

/**
 * Preview rewards without claiming (for ConfigPanel display).
 */
export function previewClaimableRewards(walletAddress: string): {
  pools: { poolAddress: string; tokenA: string; tokenB: string; rewardUSD: number; daysElapsed: number }[];
  totalUSD: number;
} {
  const { getUserPositionsFromStorage: getPos, getAccruedRewards: getRewards } = require('./liquidityPool');
  const positions = getUserPositionsFromStorage(walletAddress);

  // Import MOCK_POOLS — re-derive from positions by checking pool address mapping
  const POOL_META: Record<string, { tokenA: string; tokenB: string; apr: number; reserveA: number; reserveB: number; lpSupply: number; fee: number; mode: 'mock' }> = {
    'MockPool11111111111111111111111111111111111': { tokenA: 'SOL', tokenB: 'USDC', apr: 24.5, reserveA: 10000, reserveB: 1500000, lpSupply: 100000, fee: 0.25, mode: 'mock' },
    'MockPool22222222222222222222222222222222222': { tokenA: 'SOL', tokenB: 'USDT', apr: 18.2, reserveA: 5000, reserveB: 750000, lpSupply: 50000, fee: 0.25, mode: 'mock' },
    'MockPool33333333333333333333333333333333333': { tokenA: 'RAY', tokenB: 'SOL', apr: 32.1, reserveA: 100000, reserveB: 2000, lpSupply: 25000, fee: 0.25, mode: 'mock' },
  };

  let totalUSD = 0;
  const pools = positions
    .filter(p => p.lpBalance > 0)
    .map(p => {
      const meta = POOL_META[p.poolAddress];
      if (!meta) return null;
      const pool = { poolAddress: p.poolAddress, ...meta };
      const { daysElapsed, rewardUSD } = getAccruedRewards(p, pool);
      totalUSD += rewardUSD;
      return { poolAddress: p.poolAddress, tokenA: meta.tokenA, tokenB: meta.tokenB, rewardUSD, daysElapsed };
    })
    .filter(Boolean) as { poolAddress: string; tokenA: string; tokenB: string; rewardUSD: number; daysElapsed: number }[];

  return { pools, totalUSD };
}
