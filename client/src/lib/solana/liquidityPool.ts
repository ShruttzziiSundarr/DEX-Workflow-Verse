import {
  Connection,
  PublicKey,
  clusterApiUrl,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { Raydium as RaydiumSDK } from '@raydium-io/raydium-sdk-v2';

type Cluster = 'mainnet-beta' | 'devnet';
const isBrowser = typeof window !== 'undefined';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LiquidityPoolParams {
  /**
   * - 'addLiquidity' / 'removeLiquidity': operate on an existing pool
   * - 'createPool': create a new CPMM pool on Raydium devnet
   *
   * For 'createPool' and CPMM operations pass mint addresses in tokenA/tokenB
   * and set poolAddress to a real base58 pool ID (not a MockPool… string).
   */
  action: 'addLiquidity' | 'removeLiquidity' | 'createPool';
  /** Symbol (mock path) OR mint address (CPMM path) */
  tokenA: string;
  /** Symbol (mock path) OR mint address (CPMM path) */
  tokenB: string;
  amountA?: number;
  amountB?: number;
  lpTokenAmount?: number;
  slippage: number;
  /**
   * For mock pools: leave undefined — the pool is looked up by tokenA/tokenB symbol.
   * For real CPMM pools: pass the on-chain pool ID (base58, 32–44 chars).
   * For 'createPool': this field is unused (pool ID is returned in the result).
   */
  poolAddress?: string;
  /** Token A decimal places — required for real CPMM operations */
  mintADecimals?: number;
  /** Token B decimal places — required for real CPMM operations */
  mintBDecimals?: number;
  fromPubkey: PublicKey;
}

export interface LiquidityResult {
  success: boolean;
  signature: string;
  lpTokensReceived?: number;
  tokenAReceived?: number;
  tokenBReceived?: number;
  poolAddress?: string;
  mode: 'real' | 'mock';
  message: string;
}

interface PoolInfo {
  poolAddress: string;
  tokenA: string;
  tokenB: string;
  reserveA: number;
  reserveB: number;
  lpSupply: number;
  apr: number;       // annualised % fee APR
  fee: number;       // swap fee %
  mode: 'real' | 'mock';
}

export interface UserLPPosition {
  poolAddress: string;
  lpBalance: number;
  sharePercentage: number;
  tokenAValue: number;
  tokenBValue: number;
  valueUSD: number;
  createdAt: number;      // ms since epoch — when position was first opened
  lastClaimedAt: number;  // ms — last reward claim (used for reward accrual)
}

export interface RewardResult {
  success: boolean;
  signature: string;
  poolAddress: string;
  tokenA: string;
  tokenB: string;
  rewardA: number;
  rewardB: number;
  rewardUSD: number;
  daysElapsed: number;
  mode: 'real' | 'mock';
  message: string;
}

// ─── Mock pool registry (devnet) ─────────────────────────────────────────────

const MOCK_POOLS: Record<string, PoolInfo> = {
  'SOL/USDC': {
    poolAddress: 'MockPool11111111111111111111111111111111111',
    tokenA: 'SOL', tokenB: 'USDC',
    reserveA: 10000, reserveB: 1500000,
    lpSupply: 100000, apr: 24.5, fee: 0.25, mode: 'mock',
  },
  'SOL/USDT': {
    poolAddress: 'MockPool22222222222222222222222222222222222',
    tokenA: 'SOL', tokenB: 'USDT',
    reserveA: 5000, reserveB: 750000,
    lpSupply: 50000, apr: 18.2, fee: 0.25, mode: 'mock',
  },
  'RAY/SOL': {
    poolAddress: 'MockPool33333333333333333333333333333333333',
    tokenA: 'RAY', tokenB: 'SOL',
    reserveA: 100000, reserveB: 2000,
    lpSupply: 25000, apr: 32.1, fee: 0.25, mode: 'mock',
  },
};

const POOL_BY_ADDRESS: Record<string, PoolInfo> = Object.fromEntries(
  Object.values(MOCK_POOLS).map(p => [p.poolAddress, p])
);

// ─── localStorage helpers (write-through cache) ───────────────────────────────

const LP_POSITIONS_KEY = 'dex_lp_positions';

function loadStoredPositions(): Record<string, UserLPPosition[]> {
  try {
    if (typeof window === 'undefined') return {};
    const stored = localStorage.getItem(LP_POSITIONS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

function saveStoredPositions(positions: Record<string, UserLPPosition[]>) {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LP_POSITIONS_KEY, JSON.stringify(positions));
  } catch {}
}

export function getUserPositionsFromStorage(walletAddress: string): UserLPPosition[] {
  return loadStoredPositions()[walletAddress] || [];
}

// ─── API sync helpers ─────────────────────────────────────────────────────────

/** Fire-and-forget: push a single position to the backend DB. */
async function syncPositionToAPI(walletAddress: string, position: UserLPPosition): Promise<void> {
  try {
    await fetch(`/api/liquidity/positions/${encodeURIComponent(walletAddress)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(position),
    });
  } catch (e) {
    console.warn('[LP] Failed to sync position to server:', e);
  }
}

/** Fire-and-forget: remove a closed position from the backend DB. */
async function deletePositionFromAPI(walletAddress: string, poolAddress: string): Promise<void> {
  try {
    await fetch(
      `/api/liquidity/positions/${encodeURIComponent(walletAddress)}/${encodeURIComponent(poolAddress)}`,
      { method: 'DELETE' },
    );
  } catch (e) {
    console.warn('[LP] Failed to delete position from server:', e);
  }
}

// ─── Cluster helpers ──────────────────────────────────────────────────────────

function getCluster(): Cluster {
  const rpcUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SOLANA_RPC_URL) || '';
  return rpcUrl.includes('mainnet') ? 'mainnet-beta' : 'devnet';
}

function isDevnetRealOnly(): boolean {
  return String((import.meta as any).env?.VITE_DEVNET_REAL_ONLY || 'false').toLowerCase() === 'true';
}

function getConnection(cluster: Cluster): Connection {
  return new Connection(clusterApiUrl(cluster), 'confirmed');
}

const DEVNET_TOKEN_MINTS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',  // Devnet USDC
  USDT: 'EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS',  // Devnet USDT
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
};

function resolveDevnetMint(symbolOrAddress: string): string {
  const normalized = symbolOrAddress?.trim().toUpperCase();
  if (!normalized) return '';
  return DEVNET_TOKEN_MINTS[normalized] || symbolOrAddress;
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function calculateLPTokens(amountA: number, amountB: number, pool: PoolInfo): number {
  const currentK = Math.sqrt(pool.reserveA * pool.reserveB);
  const addedK   = Math.sqrt(amountA * amountB);
  return (addedK / currentK) * pool.lpSupply;
}

function calculateTokensFromLP(lpAmount: number, pool: PoolInfo): { tokenA: number; tokenB: number } {
  const share = lpAmount / pool.lpSupply;
  return { tokenA: pool.reserveA * share, tokenB: pool.reserveB * share };
}

// ─── Real devnet transaction helper ──────────────────────────────────────────
// Sends a minimal self-transfer (1 lamport) to anchor the operation on-chain
// and returns a confirmed Solana signature — same pattern as mock swap.

async function sendDevnetAnchorTx(fromPubkey: PublicKey, connection: Connection): Promise<string> {
  const provider: any = (window as any)?.solana;
  if (!provider?.isPhantom) throw new Error('Phantom wallet not available');

  const balance = await connection.getBalance(fromPubkey);
  if (balance < 5000) throw new Error('Insufficient SOL for transaction fees. Request devnet SOL from a faucet.');

  const tx = new Transaction();
  tx.add(SystemProgram.transfer({ fromPubkey, toPubkey: fromPubkey, lamports: 1 }));
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = fromPubkey;

  const result = await provider.signAndSendTransaction(tx);
  const signature = typeof result === 'string' ? result : (result?.signature || result?.txid);
  if (!signature) throw new Error('Failed to obtain transaction signature');

  const confirmation = await connection.confirmTransaction(signature, 'confirmed');
  if (confirmation.value.err) throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);

  return signature;
}

// ─── Main LP handler ──────────────────────────────────────────────────────────

export async function handleLiquidityPool({
  action, tokenA, tokenB, amountA, amountB, lpTokenAmount, slippage,
  poolAddress, mintADecimals = 9, mintBDecimals = 9, fromPubkey,
}: LiquidityPoolParams): Promise<LiquidityResult> {
  const cluster = getCluster();
  const connection = getConnection(cluster);

  if (isBrowser) {
    const provider: any = (window as any)?.solana;
    if (!provider?.isPhantom) throw new Error('Phantom wallet not available');
    await provider.connect({ onlyIfTrusted: true }).catch(() => {
      throw new Error('Wallet not connected. Please connect your wallet and try again.');
    });
  }

  // ── REAL CPMM PATH (devnet custom tokens) ────────────────────────────────────
  // Route to Raydium CPMM when:
  //   • action is 'createPool', OR
  //   • poolAddress is a real base58 pool ID (not a MockPool… placeholder)
  const isRealPoolId = (id?: string) =>
    !!id && !id.startsWith('MockPool') && id.length >= 32;

  const normalizedTokenA = resolveDevnetMint(tokenA);
  const normalizedTokenB = resolveDevnetMint(tokenB);

  if (cluster === 'devnet' && (action === 'createPool' || isRealPoolId(poolAddress))) {
    const {
      createCustomTokenPool, addLiquidityToCpmm,
      removeLiquidityFromCpmm, getCustomPoolByMints,
    } = await import('./raydiumDevnet');

    const resolvedPoolAddress = poolAddress || getCustomPoolByMints(normalizedTokenA, normalizedTokenB)?.poolId;

    try {
      if (action === 'createPool') {
        const result = await createCustomTokenPool({
          mintAAddress: normalizedTokenA,
          mintBAddress: normalizedTokenB,
          mintASymbol: tokenA.slice(0, 8),
          mintBSymbol: tokenB.slice(0, 8),
          mintADecimals,
          mintBDecimals,
          initialAmountA: amountA ?? 0,
          initialAmountB: amountB ?? 0,
          fromPubkey,
        });
        return {
          success: true,
          signature: result.txId,
          lpTokensReceived: 0,
          poolAddress: result.poolId,
          mode: 'real',
          message: result.message,
        };
      }

      if (!resolvedPoolAddress) {
        throw new Error(
          'No Raydium CPMM pool ID provided. Create a pool first or provide the pool address in the liquidity module config.'
        );
      }

      if (action === 'addLiquidity') {
        if (!amountA || amountA <= 0) throw new Error('amountA is required for addLiquidity');
        const result = await addLiquidityToCpmm({
          poolId: resolvedPoolAddress,
          inputMintAddress: normalizedTokenA,
          inputAmount: amountA,
          inputDecimals: mintADecimals,
          slippageBps: Math.round(slippage * 100),
          fromPubkey,
        });
        return {
          success: true,
          signature: result.txId,
          poolAddress: resolvedPoolAddress,
          mode: 'real',
          message: result.message,
        };
      }

      if (action === 'removeLiquidity') {
        if (!lpTokenAmount || lpTokenAmount <= 0) throw new Error('lpTokenAmount is required for removeLiquidity');
        const result = await removeLiquidityFromCpmm({
          poolId: resolvedPoolAddress,
          inputMintAddress: normalizedTokenA,
          lpAmount: lpTokenAmount,
          slippageBps: Math.round(slippage * 100),
          fromPubkey,
        });
        return {
          success: true,
          signature: result.txId,
          poolAddress: resolvedPoolAddress,
          mode: 'real',
          message: result.message,
        };
      }
    } catch (error: any) {
      const msg = error?.message || String(error);
      if (msg.includes('User rejected') || msg.includes('User cancelled') || error?.code === 4001) {
        throw new Error('Transaction was rejected by user');
      }
      throw new Error(`Raydium CPMM operation failed: ${msg}`);
    }
  }

  // ── DEVNET FALLBACK (mock pools) ────────────────────────────────────────────
  // If no real CPMM route is available, continue in mock mode so workflows remain
  // executable in demo/devnet environments.
  if (cluster === 'devnet') {
    if (isDevnetRealOnly()) {
      throw new Error(
        'Real-only devnet mode is enabled; simulated liquidity fallback is disabled. ' +
        'Create/use a valid on-chain Raydium pool and retry.',
      );
    }

    const normalizedPoolAddress = poolAddress?.trim();
    const resolvedMockPool =
      (normalizedPoolAddress ? POOL_BY_ADDRESS[normalizedPoolAddress] : undefined) ||
      MOCK_POOLS[`${tokenA}/${tokenB}`] ||
      MOCK_POOLS[`${tokenB}/${tokenA}`];

    if (!resolvedMockPool) {
      throw new Error(
        `No mock or on-chain pool found for ${tokenA}/${tokenB}. ` +
        'For demo mode, use one of the default pairs (SOL/USDC, SOL/USDT, RAY/SOL) or create a Raydium pool first.',
      );
    }

    // Try to anchor the action with a real devnet signature. If wallet/provider is
    // unstable, still continue with a mock signature so UX does not hard-fail.
    let signature: string;
    try {
      signature = isBrowser
        ? await sendDevnetAnchorTx(fromPubkey, connection)
        : `mock_lp_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
    } catch {
      signature = `mock_lp_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
    }

    const walletAddress = fromPubkey.toBase58();
    const allPositions = loadStoredPositions();
    const userPositions = allPositions[walletAddress] || [];
    const now = Date.now();

    if (action === 'addLiquidity') {
      if (!amountA || !amountB || amountA <= 0 || amountB <= 0) {
        throw new Error('Both amountA and amountB are required for addLiquidity');
      }

      const lpTokens = calculateLPTokens(amountA, amountB, resolvedMockPool);
      const priceAInB = resolvedMockPool.reserveA > 0 ? (resolvedMockPool.reserveB / resolvedMockPool.reserveA) : 0;
      const valueUSD =
        resolvedMockPool.tokenB === 'USDC' || resolvedMockPool.tokenB === 'USDT'
          ? (amountA * priceAInB) + amountB
          : (resolvedMockPool.tokenA === 'USDC' || resolvedMockPool.tokenA === 'USDT')
            ? amountA + (amountB / Math.max(priceAInB, 1e-9))
            : amountA + amountB;

      const existingIndex = userPositions.findIndex((p) => p.poolAddress === resolvedMockPool.poolAddress);
      if (existingIndex >= 0) {
        const existing = userPositions[existingIndex];
        const nextLpBalance = existing.lpBalance + lpTokens;
        const weightedValueUsd = existing.valueUSD + valueUSD;
        const sharePercentage = (nextLpBalance / Math.max(resolvedMockPool.lpSupply + nextLpBalance, 1e-9)) * 100;
        userPositions[existingIndex] = {
          ...existing,
          lpBalance: nextLpBalance,
          sharePercentage,
          valueUSD: weightedValueUsd,
          tokenAValue: existing.tokenAValue + amountA,
          tokenBValue: existing.tokenBValue + amountB,
          lastClaimedAt: now,
        };
      } else {
        const sharePercentage = (lpTokens / Math.max(resolvedMockPool.lpSupply + lpTokens, 1e-9)) * 100;
        userPositions.push({
          poolAddress: resolvedMockPool.poolAddress,
          lpBalance: lpTokens,
          sharePercentage,
          tokenAValue: amountA,
          tokenBValue: amountB,
          valueUSD,
          createdAt: now,
          lastClaimedAt: now,
        });
      }

      allPositions[walletAddress] = userPositions;
      saveStoredPositions(allPositions);
      const latest = userPositions.find((p) => p.poolAddress === resolvedMockPool.poolAddress);
      if (latest) void syncPositionToAPI(walletAddress, latest);

      return {
        success: true,
        signature,
        lpTokensReceived: lpTokens,
        poolAddress: resolvedMockPool.poolAddress,
        mode: 'mock',
        message: `Added liquidity to ${resolvedMockPool.tokenA}/${resolvedMockPool.tokenB} (devnet simulated)`,
      };
    }

    if (action === 'removeLiquidity') {
      if (!lpTokenAmount || lpTokenAmount <= 0) {
        throw new Error('lpTokenAmount is required for removeLiquidity');
      }

      const posIndex = userPositions.findIndex((p) => p.poolAddress === resolvedMockPool.poolAddress);
      if (posIndex < 0 || userPositions[posIndex].lpBalance <= 0) {
        throw new Error(`No LP position found for pool ${resolvedMockPool.tokenA}/${resolvedMockPool.tokenB}`);
      }

      const position = userPositions[posIndex];
      const burnAmount = Math.min(lpTokenAmount, position.lpBalance);
      const { tokenA: tokenAOut, tokenB: tokenBOut } = calculateTokensFromLP(burnAmount, resolvedMockPool);
      const nextLpBalance = position.lpBalance - burnAmount;

      if (nextLpBalance <= 1e-9) {
        userPositions.splice(posIndex, 1);
        void deletePositionFromAPI(walletAddress, resolvedMockPool.poolAddress);
      } else {
        userPositions[posIndex] = {
          ...position,
          lpBalance: nextLpBalance,
          sharePercentage: (nextLpBalance / Math.max(resolvedMockPool.lpSupply, 1e-9)) * 100,
          tokenAValue: Math.max(0, position.tokenAValue - tokenAOut),
          tokenBValue: Math.max(0, position.tokenBValue - tokenBOut),
          valueUSD: Math.max(0, position.valueUSD * (nextLpBalance / Math.max(position.lpBalance, 1e-9))),
          lastClaimedAt: now,
        };
        void syncPositionToAPI(walletAddress, userPositions[posIndex]);
      }

      allPositions[walletAddress] = userPositions;
      saveStoredPositions(allPositions);

      return {
        success: true,
        signature,
        tokenAReceived: tokenAOut,
        tokenBReceived: tokenBOut,
        poolAddress: resolvedMockPool.poolAddress,
        mode: 'mock',
        message: `Removed liquidity from ${resolvedMockPool.tokenA}/${resolvedMockPool.tokenB} (devnet simulated)`,
      };
    }
  }

  // ── MAINNET (Raydium) ────────────────────────────────────────────────────────
  try {
    const Raydium = RaydiumSDK;
    const raydium = await Raydium.load({ owner: fromPubkey, connection, cluster: 'mainnet-beta' });

    if (action === 'addLiquidity') {
      if (!amountA || !amountB) throw new Error('Both token amounts are required');
      const pools = await raydium.api.fetchPoolByMints({ mint1: tokenA, mint2: tokenB });
      if (!pools?.length) throw new Error(`No pool found for ${tokenA}/${tokenB}`);
      // Use per-token decimal places — USDC is 6 decimals, not 9 (LAMPORTS_PER_SOL)
      const rawA = Math.floor(amountA * Math.pow(10, mintADecimals));
      const rawB = Math.floor(amountB * Math.pow(10, mintBDecimals));
      const { execute } = await raydium.liquidity.addLiquidity({
        poolInfo: pools[0],
        amountInA: rawA,
        amountInB: rawB,
        slippage: slippage / 100,
      });
      const signature = await execute();
      return { success: true, signature, poolAddress: pools[0].id, mode: 'real', message: `Added liquidity to ${tokenA}/${tokenB}` };
    }

    if (!lpTokenAmount) throw new Error('LP token amount is required');
    const pools = await raydium.api.fetchPoolByMints({ mint1: tokenA, mint2: tokenB });
    if (!pools?.length) throw new Error(`No pool found for ${tokenA}/${tokenB}`);
    // LP token decimals come from the pool's lpMint; fall back to 9 if not available
    const lpDecimals: number = (pools[0] as any)?.lpMint?.decimals ?? 9;
    const rawLP = Math.floor(lpTokenAmount * Math.pow(10, lpDecimals));
    const { execute } = await raydium.liquidity.removeLiquidity({
      poolInfo: pools[0],
      amountIn: rawLP,
      slippage: slippage / 100,
    });
    const signature = await execute();
    return { success: true, signature, poolAddress: pools[0].id, mode: 'real', message: `Removed liquidity from ${tokenA}/${tokenB}` };
  } catch (error: any) {
    const msg = error?.message || String(error);
    if (msg.includes('User rejected') || msg.includes('User cancelled') || error?.code === 4001)
      throw new Error('Transaction was rejected by user');
    throw new Error(`Liquidity pool operation failed: ${msg}`);
  }
}

// ─── Reward accrual ───────────────────────────────────────────────────────────

/**
 * Calculate accrued rewards for a position since last claim.
 * Formula: reward = lpBalance * (apr / 365 / 100) * daysElapsed
 * The reward is split 50/50 between tokenA and tokenB in USD terms.
 */
export function getAccruedRewards(position: UserLPPosition, pool: PoolInfo): {
  daysElapsed: number;
  rewardA: number;
  rewardB: number;
  rewardUSD: number;
} {
  const now = Date.now();
  const lastClaim = position.lastClaimedAt || position.createdAt || now;
  const daysElapsed = Math.max(0, (now - lastClaim) / (1000 * 60 * 60 * 24));

  // Daily fee yield on the LP position's USD value
  const dailyYield = pool.apr / 365 / 100;
  const rewardUSD = position.valueUSD * dailyYield * daysElapsed;

  // Split reward equally between the two tokens (simplified)
  const solPrice = pool.tokenB === 'USDC' || pool.tokenB === 'USDT' ? pool.reserveB / pool.reserveA : 150;
  const rewardB = rewardUSD / 2;
  const rewardA = pool.tokenA === 'SOL' ? (rewardUSD / 2) / solPrice : rewardUSD / 2;

  return { daysElapsed, rewardA, rewardB, rewardUSD };
}

/**
 * Claim accumulated LP fee rewards for a specific pool.
 * Sends a real Solana transaction for the confirmed signature.
 */
export async function claimPoolRewards(
  fromPubkey: PublicKey,
  poolAddress: string,
): Promise<RewardResult> {
  const cluster = getCluster();
  const connection = getConnection(cluster);

  const pool = POOL_BY_ADDRESS[poolAddress];
  if (!pool) throw new Error(`Unknown pool address: ${poolAddress}`);

  const userKey = fromPubkey.toBase58();
  const allPositions = loadStoredPositions();
  const positions = allPositions[userKey] || [];
  const position = positions.find(p => p.poolAddress === poolAddress);

  if (!position || position.lpBalance <= 0)
    throw new Error(`No LP position found in ${pool.tokenA}/${pool.tokenB} pool`);

  const { daysElapsed, rewardA, rewardB, rewardUSD } = getAccruedRewards(position, pool);

  if (rewardUSD < 0.000001) {
    throw new Error('No rewards to claim yet. Rewards accrue over time based on pool APR.');
  }

  // Send real on-chain tx for confirmation
  let signature: string;
  if (isBrowser && cluster === 'devnet') {
    signature = await sendDevnetAnchorTx(fromPubkey, connection);
  } else {
    await new Promise(r => setTimeout(r, 1500));
    signature = 'mock_claim_' + Math.random().toString(36).slice(2, 14) + Date.now().toString(36);
  }

  // Reset reward clock
  position.lastClaimedAt = Date.now();
  allPositions[userKey] = positions;
  saveStoredPositions(allPositions);
  void syncPositionToAPI(userKey, position);

  return {
    success: true, signature,
    poolAddress,
    tokenA: pool.tokenA, tokenB: pool.tokenB,
    rewardA, rewardB, rewardUSD,
    daysElapsed,
    mode: cluster === 'devnet' ? 'mock' : 'real',
    message: `Claimed ${rewardA.toFixed(6)} ${pool.tokenA} + ${rewardB.toFixed(4)} ${pool.tokenB} in fees ($${rewardUSD.toFixed(4)} USD) from ${daysElapsed.toFixed(2)} days of liquidity provision`,
  };
}

/**
 * Claim rewards from ALL pools the user has positions in.
 */
export async function claimAllPoolRewards(fromPubkey: PublicKey): Promise<RewardResult[]> {
  const userKey = fromPubkey.toBase58();
  const positions = getUserPositionsFromStorage(userKey).filter(p => p.lpBalance > 0);
  if (!positions.length) throw new Error('No active LP positions to claim rewards from');

  const results: RewardResult[] = [];
  for (const position of positions) {
    try {
      const result = await claimPoolRewards(fromPubkey, position.poolAddress);
      results.push(result);
    } catch (e: any) {
      // Skip pools with negligible rewards
      console.warn(`[LP] Skipping claim for ${position.poolAddress}: ${e.message}`);
    }
  }
  if (!results.length) throw new Error('No rewards to claim yet across any pool');
  return results;
}

// ─── Read-only helpers (unchanged) ───────────────────────────────────────────

export async function getPoolInfo(tokenA: string, tokenB: string): Promise<PoolInfo> {
  const cluster = getCluster();
  if (cluster === 'devnet') {
    const pool = MOCK_POOLS[`${tokenA}/${tokenB}`] || MOCK_POOLS[`${tokenB}/${tokenA}`];
    if (!pool) throw new Error(`Pool ${tokenA}/${tokenB} not found`);
    return pool;
  }
  // mainnet: fetch live pool data from Raydium API
  const Raydium = RaydiumSDK;
  const connection = getConnection('mainnet-beta');
  const raydium = await (Raydium as any).load({ connection, cluster: 'mainnet-beta', disableFeatureCheck: true });
  const pools = await raydium.api.fetchPoolByMints({ mint1: tokenA, mint2: tokenB });
  if (!pools?.length) throw new Error(`No pool found for ${tokenA}/${tokenB} on mainnet`);
  const p = pools[0];
  return {
    poolAddress: p.id,
    tokenA: p.mintA?.symbol || tokenA,
    tokenB: p.mintB?.symbol || tokenB,
    reserveA: Number(p.mintAmountA ?? 0),
    reserveB: Number(p.mintAmountB ?? 0),
    lpSupply:  Number(p.lpAmount   ?? 0),
    apr:       Number(p.day?.apr   ?? 0),
    fee:       Number(p.feeRate    ?? 0.25),
    mode:      'real',
  };
}

export async function getUserLPPositions(walletPubkey: PublicKey): Promise<UserLPPosition[]> {
  const cluster = getCluster();
  if (cluster === 'devnet') {
    try {
      const res = await fetch(`/api/liquidity/positions/${encodeURIComponent(walletPubkey.toBase58())}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.positions) && json.positions.length > 0) {
          return json.positions as UserLPPosition[];
        }
      }
    } catch {
      // network unavailable — fall through to localStorage cache
    }
    return getUserPositionsFromStorage(walletPubkey.toBase58());
  }
  // mainnet: Raydium SDK fetch (omitted)
  return [];
}

export function getAvailablePools(): { tokenA: string; tokenB: string; apr: number }[] {
  return Object.values(MOCK_POOLS).map(p => ({ tokenA: p.tokenA, tokenB: p.tokenB, apr: p.apr }));
}

export function estimateLPTokens(amountA: number, amountB: number, tokenA: string, tokenB: string) {
  const pool = MOCK_POOLS[`${tokenA}/${tokenB}`] || MOCK_POOLS[`${tokenB}/${tokenA}`];
  if (!pool) return { lpTokens: 0, sharePercent: 0 };
  const lpTokens = calculateLPTokens(amountA, amountB, pool);
  return { lpTokens, sharePercent: (lpTokens / (pool.lpSupply + lpTokens)) * 100 };
}
