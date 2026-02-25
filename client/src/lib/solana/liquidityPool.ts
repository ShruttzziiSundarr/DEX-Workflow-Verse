import { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js';

// Use a variable so Vite does not statically trace the optional mainnet-only dependency
const RAYDIUM_PKG = '@raydium-io/raydium-sdk-v2';

type Cluster = 'mainnet-beta' | 'devnet';

// Check if we're running in browser or server
const isBrowser = typeof window !== 'undefined';

interface LiquidityPoolParams {
  action: 'addLiquidity' | 'removeLiquidity';
  tokenA: string;           // Token A symbol (e.g., "SOL")
  tokenB: string;           // Token B symbol (e.g., "USDC")
  amountA?: number;         // Amount of token A (for addLiquidity)
  amountB?: number;         // Amount of token B (for addLiquidity)
  lpTokenAmount?: number;   // LP token amount (for removeLiquidity)
  slippage: number;         // Slippage tolerance in percentage
  poolAddress?: string;     // Pool address (optional, for specific pools)
  fromPubkey: PublicKey;
}

interface LiquidityResult {
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
  apr: number;
  fee: number;
  mode: 'real' | 'mock';
}

interface UserLPPosition {
  poolAddress: string;
  lpBalance: number;
  sharePercentage: number;
  tokenAValue: number;
  tokenBValue: number;
  valueUSD: number;
}

// Mock pool data for devnet testing
const MOCK_POOLS: Record<string, PoolInfo> = {
  'SOL/USDC': {
    poolAddress: 'MockPool11111111111111111111111111111111111',
    tokenA: 'SOL',
    tokenB: 'USDC',
    reserveA: 10000,
    reserveB: 1500000,
    lpSupply: 100000,
    apr: 24.5,
    fee: 0.25,
    mode: 'mock',
  },
  'SOL/USDT': {
    poolAddress: 'MockPool22222222222222222222222222222222222',
    tokenA: 'SOL',
    tokenB: 'USDT',
    reserveA: 5000,
    reserveB: 750000,
    lpSupply: 50000,
    apr: 18.2,
    fee: 0.25,
    mode: 'mock',
  },
  'RAY/SOL': {
    poolAddress: 'MockPool33333333333333333333333333333333333',
    tokenA: 'RAY',
    tokenB: 'SOL',
    reserveA: 100000,
    reserveB: 2000,
    lpSupply: 25000,
    apr: 32.1,
    fee: 0.25,
    mode: 'mock',
  },
};

// LP positions persisted in localStorage so they survive page refreshes
const LP_POSITIONS_KEY = 'dex_lp_positions';

function loadStoredPositions(): Record<string, UserLPPosition[]> {
  try {
    if (typeof window === 'undefined') return {};
    const stored = localStorage.getItem(LP_POSITIONS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveStoredPositions(positions: Record<string, UserLPPosition[]>) {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LP_POSITIONS_KEY, JSON.stringify(positions));
  } catch {}
}

/** Synchronously read a user's LP positions from localStorage (used by UI components) */
export function getUserPositionsFromStorage(walletAddress: string): UserLPPosition[] {
  return loadStoredPositions()[walletAddress] || [];
}

/**
 * Get the current cluster from environment
 */
function getCluster(): Cluster {
  const rpcUrl = process.env.VITE_SOLANA_RPC_URL || '';
  if (rpcUrl.includes('mainnet') || rpcUrl.includes('api.mainnet')) {
    return 'mainnet-beta';
  }
  return 'devnet';
}

/**
 * Get connection for the cluster
 */
function getConnection(cluster: Cluster): Connection {
  return new Connection(clusterApiUrl(cluster), 'confirmed');
}

/**
 * Calculate LP tokens received for adding liquidity
 * Uses constant product formula: lpTokens = sqrt(amountA * amountB) * (totalLpSupply / sqrt(reserveA * reserveB))
 */
function calculateLPTokens(amountA: number, amountB: number, pool: PoolInfo): number {
  const currentK = Math.sqrt(pool.reserveA * pool.reserveB);
  const addedK = Math.sqrt(amountA * amountB);
  return (addedK / currentK) * pool.lpSupply;
}

/**
 * Calculate tokens received for removing liquidity
 */
function calculateTokensFromLP(lpAmount: number, pool: PoolInfo): { tokenA: number; tokenB: number } {
  const sharePercent = lpAmount / pool.lpSupply;
  return {
    tokenA: pool.reserveA * sharePercent,
    tokenB: pool.reserveB * sharePercent,
  };
}

/**
 * Main liquidity pool handler
 * - Mocks on devnet (Raydium doesn't fully exist there)
 * - Uses real Raydium SDK on mainnet
 */
export async function handleLiquidityPool({
  action,
  tokenA,
  tokenB,
  amountA,
  amountB,
  lpTokenAmount,
  slippage,
  poolAddress,
  fromPubkey,
}: LiquidityPoolParams): Promise<LiquidityResult> {
  const cluster = getCluster();
  const connection = getConnection(cluster);

  // Only check for wallet in browser environment
  if (isBrowser) {
    const provider: any = (window as any)?.solana;

    if (!provider?.isPhantom) {
      throw new Error('Phantom wallet not available');
    }

    // Check wallet connection
    const isConnected = await provider.connect({ onlyIfTrusted: true }).catch(() => false);
    if (!isConnected) {
      throw new Error('Wallet not connected. Please connect your wallet and try again.');
    }
  }

  // DEVNET: Mock liquidity pool operations
  if (cluster === 'devnet') {
    console.log(`[LP][MOCK] ${action} on devnet - simulating Raydium CPMM`);

    const poolKey = `${tokenA}/${tokenB}`;
    const reversePoolKey = `${tokenB}/${tokenA}`;
    const pool = MOCK_POOLS[poolKey] || MOCK_POOLS[reversePoolKey];

    if (!pool) {
      throw new Error(`Pool ${poolKey} not found. Available pools: ${Object.keys(MOCK_POOLS).join(', ')}`);
    }

    // Simulate transaction delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate mock signature
    const mockSignature = 'mock_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);

    if (action === 'addLiquidity') {
      if (!amountA || !amountB || amountA <= 0 || amountB <= 0) {
        throw new Error('Both token amounts are required for adding liquidity');
      }

      // Calculate LP tokens to receive
      const lpTokensReceived = calculateLPTokens(amountA, amountB, pool);
      const slippageAdjusted = lpTokensReceived * (1 - slippage / 100);

      // Persist LP position to localStorage
      const userKey = fromPubkey.toBase58();
      const allPositions = loadStoredPositions();
      const existingPositions = allPositions[userKey] || [];
      const existingPosition = existingPositions.find(p => p.poolAddress === pool.poolAddress);

      if (existingPosition) {
        existingPosition.lpBalance += slippageAdjusted;
        existingPosition.sharePercentage = (existingPosition.lpBalance / (pool.lpSupply + slippageAdjusted)) * 100;
        existingPosition.tokenAValue += amountA;
        existingPosition.tokenBValue += amountB;
        existingPosition.valueUSD = existingPosition.tokenBValue * 2;
      } else {
        existingPositions.push({
          poolAddress: pool.poolAddress,
          lpBalance: slippageAdjusted,
          sharePercentage: (slippageAdjusted / (pool.lpSupply + slippageAdjusted)) * 100,
          tokenAValue: amountA,
          tokenBValue: amountB,
          valueUSD: amountB * 2,
        });
      }
      allPositions[userKey] = existingPositions;
      saveStoredPositions(allPositions);

      console.log(`[LP][MOCK] Added liquidity: ${amountA} ${tokenA} + ${amountB} ${tokenB} = ${slippageAdjusted.toFixed(4)} LP tokens`);

      return {
        success: true,
        signature: mockSignature,
        lpTokensReceived: slippageAdjusted,
        poolAddress: pool.poolAddress,
        mode: 'mock',
        message: `Successfully added ${amountA} ${tokenA} + ${amountB} ${tokenB} to pool. Received ${slippageAdjusted.toFixed(4)} LP tokens.`,
      };
    } else if (action === 'removeLiquidity') {
      if (!lpTokenAmount || lpTokenAmount <= 0) {
        throw new Error('LP token amount is required for removing liquidity');
      }

      // Calculate tokens to receive
      const { tokenA: tokenAReceived, tokenB: tokenBReceived } = calculateTokensFromLP(lpTokenAmount, pool);
      const slippageAdjustedA = tokenAReceived * (1 - slippage / 100);
      const slippageAdjustedB = tokenBReceived * (1 - slippage / 100);

      // Update persisted LP position
      const userKey = fromPubkey.toBase58();
      const allPositions = loadStoredPositions();
      const existingPositions = allPositions[userKey] || [];
      const positionIndex = existingPositions.findIndex(p => p.poolAddress === pool.poolAddress);

      if (positionIndex >= 0) {
        existingPositions[positionIndex].lpBalance -= lpTokenAmount;
        if (existingPositions[positionIndex].lpBalance <= 0) {
          existingPositions.splice(positionIndex, 1);
        }
        allPositions[userKey] = existingPositions;
        saveStoredPositions(allPositions);
      }

      console.log(`[LP][MOCK] Removed liquidity: ${lpTokenAmount} LP tokens = ${slippageAdjustedA.toFixed(4)} ${tokenA} + ${slippageAdjustedB.toFixed(4)} ${tokenB}`);

      return {
        success: true,
        signature: mockSignature,
        tokenAReceived: slippageAdjustedA,
        tokenBReceived: slippageAdjustedB,
        poolAddress: pool.poolAddress,
        mode: 'mock',
        message: `Successfully removed ${lpTokenAmount} LP tokens. Received ${slippageAdjustedA.toFixed(4)} ${tokenA} + ${slippageAdjustedB.toFixed(4)} ${tokenB}.`,
      };
    }

    throw new Error(`Unsupported action: ${action}`);
  }

  // MAINNET: Real Raydium CPMM integration
  try {
    console.log(`[LP][REAL] ${action} on mainnet using Raydium CPMM`);

    // Dynamically import Raydium SDK (only on mainnet)
    // @ts-ignore - Raydium SDK may not be installed
    const { Raydium } = await import(/* @vite-ignore */ RAYDIUM_PKG).catch(() => {
      throw new Error('Raydium SDK not installed. Run: npm install @raydium-io/raydium-sdk-v2');
    });

    // Initialize Raydium
    const raydium = await Raydium.load({
      owner: fromPubkey,
      connection,
      cluster: 'mainnet-beta',
    });

    if (action === 'addLiquidity') {
      if (!amountA || !amountB) {
        throw new Error('Both token amounts are required');
      }

      // Get pool info
      // Note: This is a simplified implementation - real implementation would need
      // to fetch the actual pool and handle token mints properly
      const pools = await raydium.api.fetchPoolByMints({
        mint1: tokenA,
        mint2: tokenB,
      });

      if (!pools || pools.length === 0) {
        throw new Error(`No pool found for ${tokenA}/${tokenB}`);
      }

      const pool = pools[0];

      // Add liquidity
      const { execute } = await raydium.liquidity.addLiquidity({
        poolInfo: pool,
        amountInA: amountA * LAMPORTS_PER_SOL,
        amountInB: amountB * LAMPORTS_PER_SOL,
        slippage: slippage / 100,
      });

      const signature = await execute();

      console.log(`[LP][REAL] Add liquidity transaction: ${signature}`);

      return {
        success: true,
        signature,
        poolAddress: pool.id,
        mode: 'real',
        message: `Successfully added liquidity to ${tokenA}/${tokenB} pool`,
      };
    } else if (action === 'removeLiquidity') {
      if (!lpTokenAmount) {
        throw new Error('LP token amount is required');
      }

      // Get pool info
      const pools = await raydium.api.fetchPoolByMints({
        mint1: tokenA,
        mint2: tokenB,
      });

      if (!pools || pools.length === 0) {
        throw new Error(`No pool found for ${tokenA}/${tokenB}`);
      }

      const pool = pools[0];

      // Remove liquidity
      const { execute } = await raydium.liquidity.removeLiquidity({
        poolInfo: pool,
        amountIn: lpTokenAmount * LAMPORTS_PER_SOL,
        slippage: slippage / 100,
      });

      const signature = await execute();

      console.log(`[LP][REAL] Remove liquidity transaction: ${signature}`);

      return {
        success: true,
        signature,
        poolAddress: pool.id,
        mode: 'real',
        message: `Successfully removed liquidity from ${tokenA}/${tokenB} pool`,
      };
    }

    throw new Error(`Unsupported action: ${action}`);
  } catch (error: any) {
    console.error('[LP] Error:', error);

    const errorMessage = error?.message || String(error);
    if (
      errorMessage.includes('User rejected') ||
      errorMessage.includes('User cancelled') ||
      error?.code === 4001
    ) {
      throw new Error('Transaction was rejected by user');
    }

    throw new Error(`Liquidity pool operation failed: ${errorMessage}`);
  }
}

/**
 * Get pool information
 */
export async function getPoolInfo(tokenA: string, tokenB: string): Promise<PoolInfo> {
  const cluster = getCluster();

  // DEVNET: Return mock pool info
  if (cluster === 'devnet') {
    const poolKey = `${tokenA}/${tokenB}`;
    const reversePoolKey = `${tokenB}/${tokenA}`;
    const pool = MOCK_POOLS[poolKey] || MOCK_POOLS[reversePoolKey];

    if (!pool) {
      throw new Error(`Pool ${poolKey} not found`);
    }

    return pool;
  }

  // MAINNET: Fetch real pool info from Raydium
  try {
    const connection = getConnection(cluster);
    // @ts-ignore - Raydium SDK may not be installed
    const { Raydium } = await import(/* @vite-ignore */ RAYDIUM_PKG).catch(() => {
      throw new Error('Raydium SDK not installed. Run: npm install @raydium-io/raydium-sdk-v2');
    });

    const raydium = await Raydium.load({
      connection,
      cluster: 'mainnet-beta',
    });

    const pools = await raydium.api.fetchPoolByMints({
      mint1: tokenA,
      mint2: tokenB,
    });

    if (!pools || pools.length === 0) {
      throw new Error(`No pool found for ${tokenA}/${tokenB}`);
    }

    const pool = pools[0];

    return {
      poolAddress: pool.id,
      tokenA,
      tokenB,
      reserveA: pool.mintAmountA / LAMPORTS_PER_SOL,
      reserveB: pool.mintAmountB / LAMPORTS_PER_SOL,
      lpSupply: pool.lpMint.supply / LAMPORTS_PER_SOL,
      apr: pool.apr24h || 0,
      fee: pool.feeRate || 0.25,
      mode: 'real',
    };
  } catch (error) {
    console.error('[LP] Error fetching pool info:', error);
    throw error;
  }
}

/**
 * Get user's LP positions
 */
export async function getUserLPPositions(walletPubkey: PublicKey): Promise<UserLPPosition[]> {
  const cluster = getCluster();

  // DEVNET: Return persisted positions from localStorage
  if (cluster === 'devnet') {
    const userKey = walletPubkey.toBase58();
    return getUserPositionsFromStorage(userKey);
  }

  // MAINNET: Fetch real positions
  try {
    const connection = getConnection(cluster);
    // @ts-ignore - Raydium SDK may not be installed
    const { Raydium } = await import(/* @vite-ignore */ RAYDIUM_PKG).catch(() => {
      throw new Error('Raydium SDK not installed');
    });

    const raydium = await Raydium.load({
      owner: walletPubkey,
      connection,
      cluster: 'mainnet-beta',
    });

    const positions = await raydium.liquidity.getUserPositionAccount();

    return positions.map((pos: any) => ({
      poolAddress: pos.poolId,
      lpBalance: pos.lpAmount / LAMPORTS_PER_SOL,
      sharePercentage: pos.sharePercent || 0,
      tokenAValue: pos.amountA / LAMPORTS_PER_SOL,
      tokenBValue: pos.amountB / LAMPORTS_PER_SOL,
      valueUSD: pos.valueUSD || 0,
    }));
  } catch (error) {
    console.error('[LP] Error fetching user positions:', error);
    return [];
  }
}

/**
 * Get available pools for trading
 */
export function getAvailablePools(): { tokenA: string; tokenB: string; apr: number }[] {
  const cluster = getCluster();

  if (cluster === 'devnet') {
    return Object.values(MOCK_POOLS).map(pool => ({
      tokenA: pool.tokenA,
      tokenB: pool.tokenB,
      apr: pool.apr,
    }));
  }

  // For mainnet, this would fetch from Raydium API
  return [];
}

/**
 * Estimate output for adding liquidity
 */
export function estimateLPTokens(
  amountA: number,
  amountB: number,
  tokenA: string,
  tokenB: string
): { lpTokens: number; sharePercent: number } {
  const poolKey = `${tokenA}/${tokenB}`;
  const reversePoolKey = `${tokenB}/${tokenA}`;
  const pool = MOCK_POOLS[poolKey] || MOCK_POOLS[reversePoolKey];

  if (!pool) {
    return { lpTokens: 0, sharePercent: 0 };
  }

  const lpTokens = calculateLPTokens(amountA, amountB, pool);
  const sharePercent = (lpTokens / (pool.lpSupply + lpTokens)) * 100;

  return { lpTokens, sharePercent };
}
