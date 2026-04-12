/**
 * Unified DEX Router — single entry point for all on-chain swap + LP operations.
 *
 * Routing priority for swaps:
 *   1. Orca Whirlpool — when orcaPoolAddress is explicitly provided
 *   2. Raydium CPMM  — when a custom pool exists in localStorage (from createPool())
 *                       OR when raydiumPoolId is explicitly provided
 *   3. Jupiter v6    — mainnet fallback; routes through best available DEX
 *   4. Error         — no route found (create a pool first on devnet)
 *
 * Routing for liquidity:
 *   - protocol: 'raydium' → Raydium CPMM (create/add/remove)
 *   - protocol: 'orca'    → Orca Whirlpools (open/close concentrated position)
 *
 * All functions use dynamic imports so the heavy SDKs are only bundled when used.
 */

import { PublicKey, Connection, clusterApiUrl } from '@solana/web3.js';

export type Cluster  = 'devnet' | 'mainnet-beta';
export type Protocol = 'raydium' | 'orca' | 'jupiter' | 'auto';

// ═══════════════════════════════════════════════════════════════════════════════
// SWAP
// ═══════════════════════════════════════════════════════════════════════════════

export interface RouterSwapParams {
  inputMintAddress:  string;
  outputMintAddress: string;
  /** Amount to sell in UI (human-readable) units */
  inputAmount:       number;
  inputDecimals:     number;
  outputDecimals?:   number;
  /** Slippage in basis points: 100 = 1 % */
  slippageBps:       number;
  walletAddress:     string;
  cluster?:          Cluster;
  /**
   * Which DEX to use.
   *  'auto'    → try Raydium CPMM (localStorage) → Jupiter (mainnet) → error
   *  'orca'    → Orca Whirlpool (requires orcaPoolAddress)
   *  'raydium' → Raydium CPMM (requires raydiumPoolId OR localStorage entry)
   *  'jupiter' → Jupiter v6 aggregator
   */
  protocol?:         Protocol;
  /** Orca pool address — required when protocol='orca' */
  orcaPoolAddress?:  string;
  /** Raydium CPMM pool ID — optional; falls back to localStorage lookup */
  raydiumPoolId?:    string;
}

export interface RouterSwapResult {
  success:  boolean;
  txId:     string;
  protocol: Protocol;
  mode:     'real' | 'mock';
  message:  string;
}

/**
 * Execute a token swap through the best available on-chain route.
 *
 * @example — auto route (devnet, custom Raydium pool)
 * const result = await routedSwap({
 *   inputMintAddress:  'YOUR_CUSTOM_TOKEN_MINT',
 *   outputMintAddress: 'So11111111111111111111111111111111111111112',
 *   inputAmount: 100,
 *   inputDecimals: 9,
 *   slippageBps: 100,
 *   walletAddress: walletPubkey.toBase58(),
 * });
 *
 * @example — explicit Orca swap
 * const result = await routedSwap({
 *   ...
 *   protocol: 'orca',
 *   orcaPoolAddress: '3KBZiL2g8C7tiZ1QoGBSoQ15P3f5psTAfzaTJXB3EFB',
 * });
 */
export async function routedSwap(params: RouterSwapParams): Promise<RouterSwapResult> {
  const {
    inputMintAddress, outputMintAddress,
    inputAmount, inputDecimals, outputDecimals = 6,
    slippageBps, walletAddress,
    cluster = 'devnet',
    protocol = 'auto',
    orcaPoolAddress, raydiumPoolId,
  } = params;

  const fromPubkey = new PublicKey(walletAddress);

  // ── Orca (explicit or auto with pool address) ──────────────────────────────
  if (protocol === 'orca' || (protocol === 'auto' && orcaPoolAddress)) {
    if (!orcaPoolAddress) {
      throw new Error('orcaPoolAddress is required when protocol="orca"');
    }
    const { swapOnOrca } = await import('./orcaWhirlpool');
    const r = await swapOnOrca({
      poolAddress: orcaPoolAddress,
      inputMintAddress, inputAmount, inputDecimals,
      slippageBps, fromPubkey, cluster,
    });
    return { success: true, txId: r.txId, protocol: 'orca', mode: 'real', message: r.message };
  }

  // ── Raydium CPMM ───────────────────────────────────────────────────────────
  if (protocol === 'raydium' || protocol === 'auto') {
    const { getCustomPoolByMints, swapInCpmmPool } = await import('./raydiumDevnet');
    const poolId = raydiumPoolId ?? getCustomPoolByMints(inputMintAddress, outputMintAddress)?.poolId;

    if (poolId) {
      const r = await swapInCpmmPool({
        poolId, inputMintAddress, inputAmount, inputDecimals, slippageBps, fromPubkey,
      });
      return { success: true, txId: r.txId, protocol: 'raydium', mode: 'real', message: r.message };
    }

    if (protocol === 'raydium') {
      throw new Error(
        'No Raydium CPMM pool found for this pair on devnet. ' +
        'Create one first: routedLiquidity({ action: "create", protocol: "raydium", ... })',
      );
    }
  }

  // ── Jupiter v6 (mainnet / fallback) ────────────────────────────────────────
  if (protocol === 'jupiter' || protocol === 'auto') {
    const { jupiterSwap } = await import('./jupiterSwap');
    const r = await jupiterSwap({
      inputMint: inputMintAddress,
      outputMint: outputMintAddress,
      uiAmount: inputAmount,
      inputDecimals,
      outputDecimals,
      slippageBps,
      userPublicKey: walletAddress,
      cluster,
    });
    return {
      success: true,
      txId: r.signature,
      protocol: 'jupiter',
      mode: r.mode,
      message: r.message ?? 'Jupiter swap completed',
    };
  }

  throw new Error(
    'No swap route available. On devnet, create a pool first or provide an orcaPoolAddress.',
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SWAP QUOTE (estimate without executing)
// ═══════════════════════════════════════════════════════════════════════════════

export interface SwapQuote {
  estimatedOutput: number;
  minOutput:       number;    // after slippage
  priceImpact:     number;    // 0–100 %
  protocol:        Protocol;
  poolId?:         string;
}

/**
 * Get a swap quote without executing the transaction.
 * Uses live on-chain reserves for accurate pricing.
 *
 * Currently supported: Raydium CPMM (devnet custom pools).
 * Returns zeros if no pool is found.
 */
export async function getSwapQuote(
  inputMintAddress:  string,
  outputMintAddress: string,
  inputAmount:       number,
  inputDecimals:     number,
  slippageBps:       number,
  walletAddress:     string,
  cluster:           Cluster = 'devnet',
): Promise<SwapQuote> {
  const fromPubkey = new PublicKey(walletAddress);
  const { getCustomPoolByMints } = await import('./raydiumDevnet');
  const pool = getCustomPoolByMints(inputMintAddress, outputMintAddress);

  if (!pool) {
    return { estimatedOutput: 0, minOutput: 0, priceImpact: 0, protocol: 'auto' };
  }

  try {
    const { Raydium } = await import(/* @vite-ignore */ '@raydium-io/raydium-sdk-v2');
    const BN = (await import(/* @vite-ignore */ 'bn.js')).default ?? (await import(/* @vite-ignore */ 'bn.js'));
    const connection = new Connection(clusterApiUrl(cluster), 'confirmed');

    const raydium = await Raydium.load({
      owner: fromPubkey, connection, cluster: 'devnet', disableFeatureCheck: true,
    });

    const poolData = await raydium.cpmm.getPoolInfoFromRpc(pool.poolId);
    if (!poolData?.rpcData) throw new Error('No pool data');

    const { poolInfo, rpcData } = poolData;
    const baseIn  = poolInfo.mintA.address === inputMintAddress;
    const amountBN = new (BN as any)(Math.floor(inputAmount * 10 ** inputDecimals).toString());

    // CpmmComputeData requires id, version, mintA, mintB, authority from poolInfo
    // plus baseReserve/quoteReserve from rpcData — spread both
    const result = raydium.cpmm.computeSwapAmount({
      pool:         { ...poolInfo, baseReserve: rpcData.baseReserve, quoteReserve: rpcData.quoteReserve } as any,
      amountIn:     amountBN,
      outputMint:   baseIn ? poolInfo.mintB.address : poolInfo.mintA.address,
      slippage:     slippageBps / 10000,
      swapBaseIn:   baseIn,
    });

    const outMint   = baseIn ? poolInfo.mintB : poolInfo.mintA;
    const estOutput = (result.amountOut as any).toNumber() / 10 ** outMint.decimals;
    const minOutput   = result.minAmountOut?.toNumber() != null
      ? result.minAmountOut.toNumber() / 10 ** outMint.decimals
      : estOutput * (1 - slippageBps / 10000);

    return {
      estimatedOutput: estOutput,
      minOutput,
      priceImpact: 0, // CPMM price impact is minimal for small trades
      protocol: 'raydium',
      poolId: pool.poolId,
    };
  } catch {
    return { estimatedOutput: 0, minOutput: 0, priceImpact: 0, protocol: 'raydium', poolId: pool.poolId };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIQUIDITY POOL
// ═══════════════════════════════════════════════════════════════════════════════

export interface RouterLiquidityParams {
  /**
   * 'create' — deploy a new pool (Raydium CPMM only)
   * 'add'    — add liquidity / open a position
   * 'remove' — remove liquidity / close a position
   */
  action:   'create' | 'add' | 'remove';
  /**
   * 'raydium' — Raydium CPMM (constant-product AMM, simpler)
   * 'orca'    — Orca Whirlpools (concentrated liquidity, more efficient)
   */
  protocol: 'raydium' | 'orca';

  mintAAddress: string;
  mintBAddress: string;
  slippageBps:  number;
  walletAddress: string;
  cluster?:      Cluster;

  // ── Raydium-specific ──────────────────────────────────────────────────────
  /** Pool ID returned by 'create'. Required for 'add' and 'remove'. */
  raydiumPoolId?:    string;
  mintADecimals?:    number;
  mintBDecimals?:    number;
  /** For 'create': display symbols (stored locally, not on-chain) */
  mintASymbol?:      string;
  mintBSymbol?:      string;
  /** For 'create': initial seed amounts */
  initialAmountA?:   number;
  initialAmountB?:   number;
  /** For 'add': amount of the "base" side to deposit exactly */
  inputAmount?:      number;
  inputDecimals?:    number;
  /** For 'remove': LP token amount to burn */
  lpAmount?:         number;
  lpDecimals?:       number;

  // ── Orca-specific ─────────────────────────────────────────────────────────
  /** Whirlpool pool address. Required for Orca 'add' and 'remove'. */
  orcaPoolAddress?: string;
  /** For Orca 'add': lower price bound of the concentration range */
  lowerPrice?:      number;
  /** For Orca 'add': upper price bound of the concentration range */
  upperPrice?:      number;
  /** For Orca 'remove': the position NFT mint returned by 'add' */
  positionMint?:    string;
}

export interface RouterLiquidityResult {
  success:       boolean;
  txId:          string;
  protocol:      'raydium' | 'orca';
  mode:          'real';
  /** Raydium: CPMM pool ID */
  poolId?:       string;
  /** Orca: position NFT mint (save this to close the position later) */
  positionMint?: string;
  message:       string;
}

/**
 * Add, remove, or create liquidity on Raydium CPMM or Orca Whirlpools.
 *
 * ── Raydium CPMM examples ─────────────────────────────────────────────────────
 *
 * // 1. Create a new pool for custom tokens
 * const { poolId } = await routedLiquidity({
 *   action: 'create', protocol: 'raydium',
 *   mintAAddress: 'YOUR_TOKEN_MINT',
 *   mintBAddress: 'So11111111111111111111111111111111111111112',
 *   mintASymbol: 'MYTKN', mintADecimals: 9,
 *   mintBSymbol: 'SOL',   mintBDecimals: 9,
 *   initialAmountA: 1_000_000, initialAmountB: 10,
 *   slippageBps: 100, walletAddress: wallet.toBase58(),
 * });
 *
 * // 2. Add liquidity to existing pool
 * await routedLiquidity({
 *   action: 'add', protocol: 'raydium',
 *   mintAAddress: 'YOUR_TOKEN_MINT', mintBAddress: 'So111...112',
 *   raydiumPoolId: poolId,
 *   inputAmount: 500_000, inputDecimals: 9,
 *   slippageBps: 100, walletAddress: wallet.toBase58(),
 * });
 *
 * // 3. Remove liquidity
 * await routedLiquidity({
 *   action: 'remove', protocol: 'raydium',
 *   mintAAddress: 'YOUR_TOKEN_MINT', mintBAddress: 'So111...112',
 *   raydiumPoolId: poolId,
 *   lpAmount: 42.5, slippageBps: 100, walletAddress: wallet.toBase58(),
 * });
 *
 * ── Orca Whirlpools examples ──────────────────────────────────────────────────
 *
 * // Open a concentrated position ($130–$170 range on SOL/USDC)
 * const { positionMint } = await routedLiquidity({
 *   action: 'add', protocol: 'orca',
 *   mintAAddress: 'So111...112', mintBAddress: 'USDC_MINT',
 *   orcaPoolAddress: 'POOL_ADDRESS',
 *   lowerPrice: 130, upperPrice: 170,
 *   inputAmount: 0.5, inputDecimals: 9,
 *   slippageBps: 100, walletAddress: wallet.toBase58(),
 * });
 *
 * // Close position
 * await routedLiquidity({
 *   action: 'remove', protocol: 'orca',
 *   mintAAddress: 'So111...112', mintBAddress: 'USDC_MINT',
 *   orcaPoolAddress: 'POOL_ADDRESS',
 *   positionMint,
 *   slippageBps: 100, walletAddress: wallet.toBase58(),
 * });
 */
export async function routedLiquidity(params: RouterLiquidityParams): Promise<RouterLiquidityResult> {
  const {
    action, protocol,
    mintAAddress, mintBAddress,
    slippageBps, walletAddress,
    cluster = 'devnet',
  } = params;

  const fromPubkey = new PublicKey(walletAddress);

  // ── Raydium CPMM ───────────────────────────────────────────────────────────
  if (protocol === 'raydium') {
    const { createCustomTokenPool, addLiquidityToCpmm, removeLiquidityFromCpmm } =
      await import('./raydiumDevnet');

    if (action === 'create') {
      if (!params.initialAmountA || !params.initialAmountB) {
        throw new Error('initialAmountA and initialAmountB are required to create a pool');
      }
      const r = await createCustomTokenPool({
        mintAAddress,  mintBAddress,
        mintASymbol:   params.mintASymbol   ?? mintAAddress.slice(0, 8),
        mintBSymbol:   params.mintBSymbol   ?? mintBAddress.slice(0, 8),
        mintADecimals: params.mintADecimals ?? 9,
        mintBDecimals: params.mintBDecimals ?? 9,
        initialAmountA: params.initialAmountA,
        initialAmountB: params.initialAmountB,
        fromPubkey,
      });
      return {
        success: true, txId: r.txId, protocol: 'raydium', mode: 'real',
        poolId: r.poolId, message: r.message,
      };
    }

    if (action === 'add') {
      if (!params.raydiumPoolId) throw new Error('raydiumPoolId is required for Raydium add liquidity');
      if (!params.inputAmount)   throw new Error('inputAmount is required for add liquidity');
      const r = await addLiquidityToCpmm({
        poolId:           params.raydiumPoolId,
        inputMintAddress: mintAAddress,
        inputAmount:      params.inputAmount,
        inputDecimals:    params.inputDecimals ?? params.mintADecimals ?? 9,
        slippageBps,      fromPubkey,
      });
      return {
        success: true, txId: r.txId, protocol: 'raydium', mode: 'real',
        poolId: params.raydiumPoolId, message: r.message,
      };
    }

    if (action === 'remove') {
      if (!params.raydiumPoolId) throw new Error('raydiumPoolId is required for Raydium remove liquidity');
      if (!params.lpAmount)      throw new Error('lpAmount is required for remove liquidity');
      const r = await removeLiquidityFromCpmm({
        poolId:           params.raydiumPoolId,
        inputMintAddress: mintAAddress,
        lpAmount:         params.lpAmount,
        lpDecimals:       params.lpDecimals,
        slippageBps,      fromPubkey,
      });
      return {
        success: true, txId: r.txId, protocol: 'raydium', mode: 'real',
        poolId: params.raydiumPoolId, message: r.message,
      };
    }
  }

  // ── Orca Whirlpools ────────────────────────────────────────────────────────
  if (protocol === 'orca') {
    const { openOrcaPosition, closeOrcaPosition } = await import('./orcaWhirlpool');

    if (action === 'create') {
      throw new Error(
        'Creating Orca Whirlpools requires the Orca config authority and is not supported here. ' +
        'Use protocol="raydium" to create a pool, then swap into it using Orca.',
      );
    }

    if (action === 'add') {
      if (!params.orcaPoolAddress)             throw new Error('orcaPoolAddress required for Orca add');
      if (params.lowerPrice == null || params.upperPrice == null) {
        throw new Error('lowerPrice and upperPrice required for Orca position');
      }
      if (!params.inputAmount) throw new Error('inputAmount required for Orca position');

      const r = await openOrcaPosition({
        poolAddress:      params.orcaPoolAddress,
        lowerPrice:       params.lowerPrice,
        upperPrice:       params.upperPrice,
        inputMintAddress: mintAAddress,
        inputAmount:      params.inputAmount,
        inputDecimals:    params.inputDecimals ?? params.mintADecimals ?? 9,
        slippageBps,      fromPubkey,        cluster,
      });
      return {
        success: true, txId: r.txId, protocol: 'orca', mode: 'real',
        positionMint: r.positionMint, message: r.message,
      };
    }

    if (action === 'remove') {
      if (!params.orcaPoolAddress) throw new Error('orcaPoolAddress required for Orca remove');
      if (!params.positionMint)    throw new Error('positionMint (NFT) required to close Orca position');

      const r = await closeOrcaPosition({
        poolAddress:  params.orcaPoolAddress,
        positionMint: params.positionMint,
        slippageBps,  fromPubkey,  cluster,
      });
      return {
        success: true, txId: r.txId, protocol: 'orca', mode: 'real', message: r.message,
      };
    }
  }

  throw new Error(`Unknown protocol "${protocol}" or action "${action}"`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE EXPORTS — pre-check token accounts before on-chain ops
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ensure ATAs exist for all mints involved in a swap.
 * Call this before routedSwap() when you know the swap involves custom tokens.
 *
 * @example
 * await prepareTokenAccounts(
 *   connection, [inputMint, outputMint], walletPubkey, phantom,
 * );
 * await routedSwap({ ... });
 */
export async function prepareTokenAccounts(
  connection: Connection,
  mintAddresses: string[],
  ownerPubkey: PublicKey,
  phantomProvider: any,
): Promise<Record<string, PublicKey>> {
  const { ensureATAs } = await import('./splTokenUtils');
  return ensureATAs(connection, mintAddresses, ownerPubkey, phantomProvider);
}
