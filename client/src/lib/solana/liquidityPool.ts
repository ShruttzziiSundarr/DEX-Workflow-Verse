import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';

const RAYDIUM_PKG = '@raydium-io/raydium-sdk-v2';
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

// ─── localStorage helpers ─────────────────────────────────────────────────────

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

// ─── Cluster helpers ──────────────────────────────────────────────────────────

function getCluster(): Cluster {
  const rpcUrl = (typeof process !== 'undefined' ? process.env?.VITE_SOLANA_RPC_URL : undefined) || '';
  return rpcUrl.includes('mainnet') ? 'mainnet-beta' : 'devnet';
}

function getConnection(cluster: Cluster): Connection {
  return new Connection(clusterApiUrl(cluster), 'confirmed');
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

  if (cluster === 'devnet' && (action === 'createPool' || isRealPoolId(poolAddress))) {
    const {
      createCustomTokenPool, addLiquidityToCpmm,
      removeLiquidityFromCpmm,
    } = await import('./raydiumDevnet');

    try {
      if (action === 'createPool') {
        const result = await createCustomTokenPool({
          mintAAddress: tokenA,
          mintBAddress: tokenB,
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

      if (action === 'addLiquidity') {
        if (!amountA || amountA <= 0) throw new Error('amountA is required for addLiquidity');
        const result = await addLiquidityToCpmm({
          poolId: poolAddress!,
          inputMintAddress: tokenA,
          inputAmount: amountA,
          inputDecimals: mintADecimals,
          slippageBps: Math.round(slippage * 100),
          fromPubkey,
        });
        return {
          success: true,
          signature: result.txId,
          poolAddress: poolAddress,
          mode: 'real',
          message: result.message,
        };
      }

      if (action === 'removeLiquidity') {
        if (!lpTokenAmount || lpTokenAmount <= 0) throw new Error('lpTokenAmount is required for removeLiquidity');
        const result = await removeLiquidityFromCpmm({
          poolId: poolAddress!,
          inputMintAddress: tokenA,
          lpAmount: lpTokenAmount,
          slippageBps: Math.round(slippage * 100),
          fromPubkey,
        });
        return {
          success: true,
          signature: result.txId,
          poolAddress: poolAddress,
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

  // ── DEVNET MOCK PATH (demo tokens: SOL/USDC, SOL/USDT, RAY/SOL) ─────────────
  if (cluster === 'devnet') {
    const poolKey = `${tokenA}/${tokenB}`;
    const reverseKey = `${tokenB}/${tokenA}`;
    const pool = MOCK_POOLS[poolKey] || MOCK_POOLS[reverseKey];
    if (!pool) throw new Error(`Pool ${poolKey} not found. Available: ${Object.keys(MOCK_POOLS).join(', ')}`);

    const now = Date.now();

    if (action === 'addLiquidity') {
      if (!amountA || !amountB || amountA <= 0 || amountB <= 0)
        throw new Error('Both token amounts are required for adding liquidity');

      const lpTokensReceived = calculateLPTokens(amountA, amountB, pool) * (1 - slippage / 100);

      // Send real on-chain tx to get a confirmed signature
      let signature: string;
      if (isBrowser) {
        signature = await sendDevnetAnchorTx(fromPubkey, connection);
      } else {
        await new Promise(r => setTimeout(r, 1500));
        signature = 'mock_lp_add_' + Math.random().toString(36).slice(2, 14) + Date.now().toString(36);
      }

      // Persist LP position
      const userKey = fromPubkey.toBase58();
      const allPositions = loadStoredPositions();
      const positions = allPositions[userKey] || [];
      const existing = positions.find(p => p.poolAddress === pool.poolAddress);

      if (existing) {
        existing.lpBalance += lpTokensReceived;
        existing.sharePercentage = (existing.lpBalance / (pool.lpSupply + existing.lpBalance)) * 100;
        existing.tokenAValue += amountA;
        existing.tokenBValue += amountB;
        existing.valueUSD = existing.tokenBValue * 2;
        // keep original createdAt, update lastClaimedAt only if never set
        if (!existing.lastClaimedAt) existing.lastClaimedAt = now;
      } else {
        positions.push({
          poolAddress: pool.poolAddress,
          lpBalance: lpTokensReceived,
          sharePercentage: (lpTokensReceived / (pool.lpSupply + lpTokensReceived)) * 100,
          tokenAValue: amountA,
          tokenBValue: amountB,
          valueUSD: amountB * 2,
          createdAt: now,
          lastClaimedAt: now,
        });
      }
      allPositions[userKey] = positions;
      saveStoredPositions(allPositions);

      return {
        success: true, signature,
        lpTokensReceived,
        poolAddress: pool.poolAddress,
        mode: 'mock',
        message: `Added ${amountA} ${tokenA} + ${amountB} ${tokenB} → received ${lpTokensReceived.toFixed(4)} LP tokens`,
      };
    }

    // removeLiquidity
    if (!lpTokenAmount || lpTokenAmount <= 0)
      throw new Error('LP token amount is required for removing liquidity');

    const { tokenA: rawA, tokenB: rawB } = calculateTokensFromLP(lpTokenAmount, pool);
    const tokenAReceived = rawA * (1 - slippage / 100);
    const tokenBReceived = rawB * (1 - slippage / 100);

    let signature: string;
    if (isBrowser) {
      signature = await sendDevnetAnchorTx(fromPubkey, connection);
    } else {
      await new Promise(r => setTimeout(r, 1500));
      signature = 'mock_lp_rem_' + Math.random().toString(36).slice(2, 14) + Date.now().toString(36);
    }

    // Update persisted position
    const userKey = fromPubkey.toBase58();
    const allPositions = loadStoredPositions();
    const positions = allPositions[userKey] || [];
    const idx = positions.findIndex(p => p.poolAddress === pool.poolAddress);
    if (idx >= 0) {
      positions[idx].lpBalance -= lpTokenAmount;
      if (positions[idx].lpBalance <= 0) {
        positions.splice(idx, 1);
      } else {
        positions[idx].sharePercentage = (positions[idx].lpBalance / pool.lpSupply) * 100;
        positions[idx].tokenAValue = Math.max(0, positions[idx].tokenAValue - tokenAReceived);
        positions[idx].tokenBValue = Math.max(0, positions[idx].tokenBValue - tokenBReceived);
        positions[idx].valueUSD = positions[idx].tokenBValue * 2;
      }
      allPositions[userKey] = positions;
      saveStoredPositions(allPositions);
    }

    return {
      success: true, signature,
      tokenAReceived, tokenBReceived,
      poolAddress: pool.poolAddress,
      mode: 'mock',
      message: `Removed ${lpTokenAmount} LP tokens → received ${tokenAReceived.toFixed(4)} ${tokenA} + ${tokenBReceived.toFixed(4)} ${tokenB}`,
    };
  }

  // ── MAINNET (Raydium) ────────────────────────────────────────────────────────
  try {
    // @ts-ignore
    const { Raydium } = await import(/* @vite-ignore */ RAYDIUM_PKG).catch(() => {
      throw new Error('Raydium SDK not installed. Run: npm install @raydium-io/raydium-sdk-v2');
    });
    const raydium = await Raydium.load({ owner: fromPubkey, connection, cluster: 'mainnet-beta' });

    if (action === 'addLiquidity') {
      if (!amountA || !amountB) throw new Error('Both token amounts are required');
      const pools = await raydium.api.fetchPoolByMints({ mint1: tokenA, mint2: tokenB });
      if (!pools?.length) throw new Error(`No pool found for ${tokenA}/${tokenB}`);
      const { execute } = await raydium.liquidity.addLiquidity({
        poolInfo: pools[0],
        amountInA: amountA * LAMPORTS_PER_SOL,
        amountInB: amountB * LAMPORTS_PER_SOL,
        slippage: slippage / 100,
      });
      const signature = await execute();
      return { success: true, signature, poolAddress: pools[0].id, mode: 'real', message: `Added liquidity to ${tokenA}/${tokenB}` };
    }

    if (!lpTokenAmount) throw new Error('LP token amount is required');
    const pools = await raydium.api.fetchPoolByMints({ mint1: tokenA, mint2: tokenB });
    if (!pools?.length) throw new Error(`No pool found for ${tokenA}/${tokenB}`);
    const { execute } = await raydium.liquidity.removeLiquidity({
      poolInfo: pools[0],
      amountIn: lpTokenAmount * LAMPORTS_PER_SOL,
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
  // mainnet omitted for brevity — same Raydium fetch as before
  throw new Error('Mainnet getPoolInfo not implemented in this build');
}

export async function getUserLPPositions(walletPubkey: PublicKey): Promise<UserLPPosition[]> {
  const cluster = getCluster();
  if (cluster === 'devnet') return getUserPositionsFromStorage(walletPubkey.toBase58());
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
