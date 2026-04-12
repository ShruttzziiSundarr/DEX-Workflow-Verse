/**
 * Raydium CPMM integration for Devnet — real on-chain pool operations
 *
 * Supports:
 *  - Creating CPMM pools for custom SPL tokens
 *  - Swapping between tokens in a CPMM pool
 *  - Adding / removing liquidity
 *
 * References:
 *  https://github.com/raydium-io/raydium-sdk-V2-demo/tree/master/src/cpmm
 *  https://stackoverflow.com/a/79352706
 *
 * Verified SDK constants (run: node -e "const s=require('@raydium-io/raydium-sdk-v2'); console.log(s.DEVNET_PROGRAM_ID, s.TxVersion)")
 *  DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM = DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb
 *  DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC = 3oE58BKVt8KuYkGxx8zBojugnymWmBiyafWgMrnb6eYy
 *  TxVersion.LEGACY = 1  (NOT 0 — counterintuitive but verified)
 */

import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

// ── Devnet CPMM constants ─────────────────────────────────────────────────────
// These are DEVNET values from DEVNET_PROGRAM_ID in @raydium-io/raydium-sdk-v2
const DEVNET_CPMM_PROGRAM = 'DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb';
const DEVNET_CPMM_FEE_ACC  = '3oE58BKVt8KuYkGxx8zBojugnymWmBiyafWgMrnb6eYy';

// Known working fee-config PDA on devnet (from raydium-sdk-V2-demo)
// If pool creation fails with "invalid fee config", replace this with the
// first id returned by raydium.api.getCpmmConfigs() on your devnet node.
const DEVNET_FEE_CONFIG_ID = '9zSzfkYy6awexsHvmggeH36pfVUdDGyCcwmjT3AQPBj6';

// TxVersion.LEGACY = 1  (verified — SDK enum is V0=0, LEGACY=1)
const TX_LEGACY = 1;

const WSOL = 'So11111111111111111111111111111111111111112';
const RAYDIUM_SDK = '@raydium-io/raydium-sdk-v2';

// ── localStorage pool registry ────────────────────────────────────────────────

const CUSTOM_POOLS_KEY = 'dex_custom_cpmm_pools';

export interface CustomPoolRecord {
  poolId: string;
  mintA: string;
  mintB: string;
  symbolA: string;
  symbolB: string;
  decimalsA: number;
  decimalsB: number;
  lpMint?: string;
  createdAt: number;
}

export function loadCustomPools(): CustomPoolRecord[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(CUSTOM_POOLS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCustomPool(pool: CustomPoolRecord) {
  try {
    if (typeof window === 'undefined') return;
    const all = loadCustomPools();
    const idx = all.findIndex(p => p.poolId === pool.poolId);
    if (idx >= 0) all[idx] = pool; else all.push(pool);
    localStorage.setItem(CUSTOM_POOLS_KEY, JSON.stringify(all));
  } catch {}
}

/** Look up a locally-created pool by token mint pair (order-insensitive). */
export function getCustomPoolByMints(mintA: string, mintB: string): CustomPoolRecord | undefined {
  return loadCustomPools().find(p =>
    (p.mintA === mintA && p.mintB === mintB) ||
    (p.mintA === mintB && p.mintB === mintA),
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CpmmCreatePoolParams {
  /** Mint address of token A (pass WSOL address for native SOL) */
  mintAAddress: string;
  /** Mint address of token B */
  mintBAddress: string;
  /** Display symbol for token A (stored locally, not on-chain) */
  mintASymbol: string;
  mintBSymbol: string;
  /** On-chain decimal places (fetch with `getTokenInfo` or from `spl-token display`) */
  mintADecimals: number;
  mintBDecimals: number;
  /** Initial liquidity to seed the pool with, in UI (human-readable) units */
  initialAmountA: number;
  initialAmountB: number;
  fromPubkey: PublicKey;
}

export interface CpmmSwapParams {
  /** Pool ID returned by createCustomTokenPool() */
  poolId: string;
  /** Mint address of the token you are selling */
  inputMintAddress: string;
  /** Amount to swap in UI units */
  inputAmount: number;
  inputDecimals: number;
  /** Slippage tolerance in basis points, e.g. 50 = 0.5 % */
  slippageBps: number;
  fromPubkey: PublicKey;
}

export interface CpmmLiquidityParams {
  poolId: string;
  /** For addLiquidity: the mint of the side you want to specify exactly */
  inputMintAddress: string;
  /** For addLiquidity: amount in UI units */
  inputAmount?: number;
  inputDecimals?: number;
  /** For removeLiquidity: LP token amount in UI units */
  lpAmount?: number;
  lpDecimals?: number;
  slippageBps: number;
  fromPubkey: PublicKey;
}

export interface CpmmResult {
  success: true;
  txId: string;
  poolId?: string;
  lpMint?: string;
  mode: 'real';
  message: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function phantomProvider() {
  if (typeof window === 'undefined') throw new Error('Browser environment required');
  const provider: any = (window as any)?.solana;
  if (!provider?.isPhantom) throw new Error('Phantom wallet not found');
  await provider.connect({ onlyIfTrusted: true }).catch(() => {
    throw new Error('Wallet not connected — please connect Phantom first');
  });
  return provider;
}

async function loadSDK() {
  return import(/* @vite-ignore */ RAYDIUM_SDK).catch(() => {
    throw new Error('Raydium SDK missing. Run: npm install @raydium-io/raydium-sdk-v2');
  });
}

/** Import BN from bn.js (transitive dep of the SDK — always present). */
async function getBN(): Promise<any> {
  const m = await import(/* @vite-ignore */ 'bn.js');
  return m.default ?? m;
}

/**
 * Initialise Raydium SDK on devnet, wired to the connected Phantom wallet.
 * `signAllTransactions` is passed so `execute({ sendAndConfirm: true })` works
 * in the browser without exposing a private key.
 */
async function initRaydium(fromPubkey: PublicKey) {
  const provider = await phantomProvider();
  const { Raydium } = await loadSDK();
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

  const raydium = await Raydium.load({
    owner: fromPubkey,
    connection,
    cluster: 'devnet',
    signAllTransactions: (txs: any[]) => provider.signAllTransactions(txs),
    disableFeatureCheck: true,
    blockhashCommitment: 'confirmed',
  });

  return { raydium, connection };
}

// ── Pool creation ─────────────────────────────────────────────────────────────

/**
 * Create a new CPMM pool on Raydium devnet for a custom SPL token pair.
 *
 * You only need to call this once per token pair.  Save the returned `poolId`
 * — pass it to swapInCpmmPool / addLiquidityToCpmm / removeLiquidityFromCpmm.
 * It is also persisted to localStorage automatically.
 *
 * @example
 * const result = await createCustomTokenPool({
 *   mintAAddress: 'YOUR_TOKEN_MINT',
 *   mintBAddress: 'So11111111111111111111111111111111111111112', // WSOL
 *   mintASymbol: 'MYTKN', mintADecimals: 9,
 *   mintBSymbol: 'SOL',   mintBDecimals: 9,
 *   initialAmountA: 1_000_000,
 *   initialAmountB: 10,
 *   fromPubkey: new PublicKey(walletAddress),
 * });
 * console.log('Pool ID:', result.poolId);
 */
export async function createCustomTokenPool(params: CpmmCreatePoolParams): Promise<CpmmResult> {
  const {
    mintAAddress, mintBAddress,
    mintASymbol, mintBSymbol,
    mintADecimals, mintBDecimals,
    initialAmountA, initialAmountB,
    fromPubkey,
  } = params;

  const { raydium } = await initRaydium(fromPubkey);
  const BN = await getBN();

  // Fetch on-chain token metadata (handles SPL token-2022 extensions too)
  const [mintAInfo, mintBInfo] = await Promise.all([
    raydium.token.getTokenInfo(mintAAddress),
    raydium.token.getTokenInfo(mintBAddress),
  ]);

  // Fetch fee configs; override the id for devnet
  const feeConfigs = await raydium.api.getCpmmConfigs();
  if (!feeConfigs?.length) {
    throw new Error(
      'No CPMM fee configs found on devnet. ' +
      'Ensure your RPC points to devnet and Raydium devnet contracts are deployed.',
    );
  }
  const feeConfig = { ...feeConfigs[0], id: DEVNET_FEE_CONFIG_ID };

  const mintAAmount = new BN(Math.floor(initialAmountA * 10 ** mintADecimals).toString());
  const mintBAmount = new BN(Math.floor(initialAmountB * 10 ** mintBDecimals).toString());
  const usesSOL = mintAAddress === WSOL || mintBAddress === WSOL;

  const { execute, extInfo } = await raydium.cpmm.createPool({
    programId:      new PublicKey(DEVNET_CPMM_PROGRAM),
    poolFeeAccount: new PublicKey(DEVNET_CPMM_FEE_ACC),
    mintA: mintAInfo,
    mintB: mintBInfo,
    mintAAmount,
    mintBAmount,
    startTime:     new BN(0),
    feeConfig,
    associatedOnly: false,
    ownerInfo:     { useSOLBalance: usesSOL },
    txVersion:      TX_LEGACY,
  });

  const { txIds } = await execute({ sendAndConfirm: true });
  const poolId  = extInfo?.address?.poolId?.toBase58?.()  ?? 'unknown';
  const lpMint  = extInfo?.address?.lpMint?.toBase58?.()  ?? undefined;

  saveCustomPool({
    poolId, lpMint,
    mintA: mintAAddress, mintB: mintBAddress,
    symbolA: mintASymbol, symbolB: mintBSymbol,
    decimalsA: mintADecimals, decimalsB: mintBDecimals,
    createdAt: Date.now(),
  });

  return {
    success: true,
    txId: txIds[0],
    poolId, lpMint,
    mode: 'real',
    message: `Pool created: ${mintASymbol}/${mintBSymbol} | ID: ${poolId} | tx: ${txIds[0]}`,
  };
}

// ── Swap ──────────────────────────────────────────────────────────────────────

/**
 * Swap tokens in an existing CPMM pool on devnet.
 *
 * `inputMintAddress` determines the sell side; the SDK computes the expected
 * output using the current on-chain reserves (via computeSwapAmount).
 *
 * @example
 * await swapInCpmmPool({
 *   poolId: 'POOL_ID_FROM_CREATE',
 *   inputMintAddress: 'YOUR_TOKEN_MINT',
 *   inputAmount: 100,
 *   inputDecimals: 9,
 *   slippageBps: 100, // 1 %
 *   fromPubkey: new PublicKey(walletAddress),
 * });
 */
export async function swapInCpmmPool(params: CpmmSwapParams): Promise<CpmmResult> {
  const { poolId, inputMintAddress, inputAmount, inputDecimals, slippageBps, fromPubkey } = params;

  const { raydium } = await initRaydium(fromPubkey);
  const BN = await getBN();

  // devnet: fetch pool from RPC directly (API may not index custom pools)
  const poolData = await raydium.cpmm.getPoolInfoFromRpc(poolId);
  if (!poolData?.poolInfo) {
    throw new Error(`Pool ${poolId.slice(0, 8)}... not found on devnet`);
  }

  const { poolInfo, poolKeys, rpcData } = poolData;

  if (poolInfo.mintA.address !== inputMintAddress && poolInfo.mintB.address !== inputMintAddress) {
    throw new Error(
      `Mint ${inputMintAddress.slice(0, 8)}... is not in pool ${poolId.slice(0, 8)}...`,
    );
  }

  const baseIn        = poolInfo.mintA.address === inputMintAddress;
  const inputAmountBn = new BN(Math.floor(inputAmount * 10 ** inputDecimals).toString());
  const slippage      = slippageBps / 10000;

  // compute expected output from on-chain reserves
  // Parameter names verified against CpmmComputeData type in SDK:
  //   { pool: CpmmComputeData; amountIn: BN; outputMint: string|PublicKey; slippage: number; swapBaseIn?: boolean }
  const swapResult = raydium.cpmm.computeSwapAmount({
    pool:       { ...poolInfo, baseReserve: rpcData.baseReserve, quoteReserve: rpcData.quoteReserve } as any,
    amountIn:   inputAmountBn,
    outputMint: baseIn ? poolInfo.mintB.address : poolInfo.mintA.address,
    slippage,
    swapBaseIn: baseIn,
  });

  const { execute } = await raydium.cpmm.swap({
    poolInfo, poolKeys,
    inputAmount:  inputAmountBn,
    swapResult,
    slippage,
    baseIn,
    txVersion: TX_LEGACY,
  });

  const { txIds } = await execute({ sendAndConfirm: true });

  const outMint    = baseIn ? poolInfo.mintB : poolInfo.mintA;
  const outAmount  = ((swapResult.amountOut as any).toNumber() / 10 ** outMint.decimals).toFixed(6);
  const outSymbol  = outMint.symbol || outMint.address.slice(0, 8);

  return {
    success: true,
    txId: txIds[0],
    poolId,
    mode: 'real',
    message: `Swapped ${inputAmount} tokens → ~${outAmount} ${outSymbol} | tx: ${txIds[0]}`,
  };
}

// ── Add liquidity ─────────────────────────────────────────────────────────────

/**
 * Add liquidity to a devnet CPMM pool.
 *
 * Specify `inputMintAddress` to pick which side you are inputting exactly;
 * the SDK will calculate how much of the other token is required to maintain
 * the current pool ratio.
 *
 * @example
 * await addLiquidityToCpmm({
 *   poolId: 'POOL_ID',
 *   inputMintAddress: 'YOUR_TOKEN_MINT', // the "base" side
 *   inputAmount: 500,
 *   inputDecimals: 9,
 *   slippageBps: 50,
 *   fromPubkey: new PublicKey(walletAddress),
 * });
 */
export async function addLiquidityToCpmm(params: CpmmLiquidityParams): Promise<CpmmResult> {
  const { poolId, inputMintAddress, inputAmount, inputDecimals = 9, slippageBps, fromPubkey } = params;
  if (!inputAmount || inputAmount <= 0) throw new Error('inputAmount must be > 0');

  const { raydium } = await initRaydium(fromPubkey);
  const BN = await getBN();

  const poolData = await raydium.cpmm.getPoolInfoFromRpc(poolId);
  if (!poolData?.poolInfo) throw new Error(`Pool ${poolId.slice(0, 8)}... not found`);

  const { poolInfo, poolKeys } = poolData;
  const baseIn        = poolInfo.mintA.address === inputMintAddress;
  const inputAmountBn = new BN(Math.floor(inputAmount * 10 ** inputDecimals).toString());
  const slippage      = slippageBps / 10000;

  const { execute, extInfo } = await raydium.cpmm.addLiquidity({
    poolInfo, poolKeys,
    inputAmount: inputAmountBn,
    slippage,
    baseIn,
    txVersion: TX_LEGACY,
  });

  const { txIds } = await execute({ sendAndConfirm: true });
  const lpReceived = extInfo?.addLpAmount?.toNumber?.() ?? 0;

  return {
    success: true,
    txId: txIds[0],
    poolId,
    mode: 'real',
    message: `Liquidity added to pool ${poolId.slice(0, 8)}... | LP received: ${lpReceived} | tx: ${txIds[0]}`,
  };
}

// ── Remove liquidity ──────────────────────────────────────────────────────────

/**
 * Burn LP tokens and withdraw the underlying token pair from a devnet CPMM pool.
 *
 * @example
 * await removeLiquidityFromCpmm({
 *   poolId: 'POOL_ID',
 *   inputMintAddress: '', // unused for remove, can pass anything
 *   lpAmount: 42.5,       // LP token amount to burn (UI units)
 *   slippageBps: 50,
 *   fromPubkey: new PublicKey(walletAddress),
 * });
 */
export async function removeLiquidityFromCpmm(params: CpmmLiquidityParams): Promise<CpmmResult> {
  const { poolId, lpAmount, lpDecimals, slippageBps, fromPubkey } = params;
  if (!lpAmount || lpAmount <= 0) throw new Error('lpAmount must be > 0');

  const { raydium } = await initRaydium(fromPubkey);
  const BN = await getBN();

  const poolData = await raydium.cpmm.getPoolInfoFromRpc(poolId);
  if (!poolData?.poolInfo) throw new Error(`Pool ${poolId.slice(0, 8)}... not found`);

  const { poolInfo, poolKeys } = poolData;
  const lpDec       = lpDecimals ?? poolInfo.lpMint?.decimals ?? 9;
  const lpAmountBn  = new BN(Math.floor(lpAmount * 10 ** lpDec).toString());
  const slippage    = slippageBps / 10000;

  const { execute, extInfo } = await raydium.cpmm.removeLiquidity({
    poolInfo, poolKeys,
    lpAmount: lpAmountBn,
    slippage,
    txVersion: TX_LEGACY,
  });

  const { txIds } = await execute({ sendAndConfirm: true });

  const aAmt   = (extInfo?.amountA?.toNumber?.() ?? 0) / 10 ** poolInfo.mintA.decimals;
  const bAmt   = (extInfo?.amountB?.toNumber?.() ?? 0) / 10 ** poolInfo.mintB.decimals;
  const symA   = poolInfo.mintA.symbol || poolInfo.mintA.address.slice(0, 6);
  const symB   = poolInfo.mintB.symbol || poolInfo.mintB.address.slice(0, 6);

  return {
    success: true,
    txId: txIds[0],
    poolId,
    mode: 'real',
    message: `Removed ${lpAmount} LP → ~${aAmt.toFixed(4)} ${symA} + ~${bAmt.toFixed(4)} ${symB} | tx: ${txIds[0]}`,
  };
}

// ── Pool lookup ───────────────────────────────────────────────────────────────

/**
 * Find a CPMM pool for a mint pair.
 * Checks localStorage first (instant, no RPC), then falls back to the Raydium API.
 * Returns null if no pool exists — user must call createCustomTokenPool() first.
 */
export async function findCpmmPool(
  mintA: string,
  mintB: string,
  fromPubkey: PublicKey,
): Promise<{ poolId: string; mintA: any; mintB: any } | null> {
  // Fast path: check pools this wallet created in this browser
  const cached = getCustomPoolByMints(mintA, mintB);
  if (cached) {
    return {
      poolId: cached.poolId,
      mintA: { address: cached.mintA, symbol: cached.symbolA, decimals: cached.decimalsA },
      mintB: { address: cached.mintB, symbol: cached.symbolB, decimals: cached.decimalsB },
    };
  }

  // Slow path: query Raydium API (may not index all devnet pools immediately)
  try {
    const { raydium } = await initRaydium(fromPubkey);
    const pools = await raydium.api.fetchPoolByMints({ mint1: mintA, mint2: mintB, type: 'cpmm' });
    if (!pools?.length) return null;
    const p = pools[0];
    return { poolId: p.id, mintA: p.mintA, mintB: p.mintB };
  } catch {
    return null;
  }
}
