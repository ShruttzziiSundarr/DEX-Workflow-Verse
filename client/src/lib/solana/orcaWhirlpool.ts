/**
 * Orca Whirlpools integration
 *
 * swapOnOrca()  — uses @orca-so/whirlpools-sdk (legacy) with the known devnet
 *                 pool for real on-chain swaps. Falls back to mock if the pool
 *                 call fails.
 *
 * openOrcaPosition() / closeOrcaPosition() — legacy SDK.
 *
 * Known devnet pools (Orca official):
 *   SOL/devUSDC  →  3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt
 *
 * Program ID: whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc  (same devnet + mainnet)
 */

import {
  Connection, PublicKey,
  clusterApiUrl,
} from '@solana/web3.js';

// ── Known devnet Whirlpool addresses ─────────────────────────────────────────

/**
 * Pre-configured Orca Whirlpool addresses on Solana Devnet.
 * Pass poolAddress from here to swapOnOrca() for instant devnet testing.
 */
export const ORCA_DEVNET_POOLS: Record<string, {
  poolAddress: string;
  tokenA: string; tokenASymbol: string;
  tokenB: string; tokenBSymbol: string;
}> = {
  'SOL/devUSDC': {
    poolAddress: '3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt',
    tokenA: 'So11111111111111111111111111111111111111112', tokenASymbol: 'SOL',
    tokenB: 'BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k', tokenBSymbol: 'devUSDC',
  },
};

// ── Constants ─────────────────────────────────────────────────────────────────

const ORCA_PROGRAM_ID = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
const ORCA_CONFIG = {
  'mainnet-beta': '2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ',
  devnet:         'FcrweFY1G9HJAHG5inkGB6pKg1HZ6x9UC2WioAfWrGkR',
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrcaSwapParams {
  poolAddress: string;
  inputMintAddress: string;
  inputAmount: number;
  inputDecimals: number;
  slippageBps: number;
  fromPubkey: PublicKey;
  cluster?: 'devnet' | 'mainnet-beta';
}

export interface OrcaPositionParams {
  poolAddress: string;
  lowerPrice: number;
  upperPrice: number;
  inputMintAddress: string;
  inputAmount: number;
  inputDecimals: number;
  slippageBps: number;
  fromPubkey: PublicKey;
  cluster?: 'devnet' | 'mainnet-beta';
}

export interface OrcaClosePositionParams {
  poolAddress: string;
  positionMint: string;
  slippageBps: number;
  fromPubkey: PublicKey;
  cluster?: 'devnet' | 'mainnet-beta';
}

export interface OrcaResult {
  success: true;
  txId: string;
  positionMint?: string;
  mode: 'real';
  message: string;
}

export interface OrcaPoolInfo {
  poolAddress: string;
  tokenA: { mint: string; symbol?: string; decimals: number };
  tokenB: { mint: string; symbol?: string; decimals: number };
  currentPrice: number;
  liquidity: string;
  tickSpacing: number;
  feeRateBps: number;
}

export const ORCA_TICK_SPACINGS = {
  ULTRA_STABLE: 1,
  STABLE: 8,
  TIGHT: 16,
  STANDARD: 64,
  VOLATILE: 128,
} as const;

// ── Internal helpers ──────────────────────────────────────────────────────────

async function getPhantom() {
  if (typeof window === 'undefined') throw new Error('Browser environment required');
  const p: any = (window as any)?.solana;
  if (!p?.isPhantom) throw new Error('Phantom wallet not found');
  await p.connect({ onlyIfTrusted: true }).catch(() => {
    throw new Error('Wallet not connected — connect Phantom first');
  });
  return p;
}

// ── Legacy SDK helpers ────────────────────────────────────────────────────────

async function loadLegacySDKs() {
  const [orca, common, anchor] = await Promise.all([
    import(/* @vite-ignore */ '@orca-so/whirlpools-sdk'),
    import(/* @vite-ignore */ '@orca-so/common-sdk'),
    import(/* @vite-ignore */ '@coral-xyz/anchor'),
  ]);
  return { orca, common, anchor };
}

async function getBN() {
  const m = await import(/* @vite-ignore */ 'bn.js');
  return (m.default ?? m) as any;
}

async function buildLegacyContext(fromPubkey: PublicKey, cluster: 'devnet' | 'mainnet-beta') {
  const provider = await getPhantom();
  const { orca, common, anchor } = await loadLegacySDKs();
  const connection = new Connection(clusterApiUrl(cluster), 'confirmed');

  const anchorWallet = {
    publicKey: fromPubkey,
    signTransaction:     (tx: any)    => provider.signTransaction(tx),
    signAllTransactions: (txs: any[]) => provider.signAllTransactions(txs),
  };

  const anchorProvider = new anchor.AnchorProvider(connection, anchorWallet as any, {
    commitment: 'confirmed',
    skipPreflight: false,
  });

  // withProvider no longer takes programId — create fetcher explicitly
  const fetcher = orca.buildDefaultAccountFetcher(connection);
  const ctx     = orca.WhirlpoolContext.withProvider(anchorProvider, fetcher);
  const client  = orca.buildWhirlpoolClient(ctx);

  return { ctx, client, orca, common, anchor, connection, fetcher };
}

// ── Swap (NEW SDK — supports devnet officially) ───────────────────────────────

/**
 * Swap tokens in an Orca Whirlpool.
 *
 * Uses @orca-so/whirlpools-sdk (legacy) with the known devnet pool for real
 * on-chain swaps — tx visible on Solana Explorer (devnet).
 *
 * Devnet pool to use:
 *   poolAddress: '3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt'  (SOL/devUSDC)
 *   inputMint:   'So11111111111111111111111111111111111111112'        (SOL)
 *
 * @example
 * await swapOnOrca({
 *   poolAddress:      '3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt',
 *   inputMintAddress: 'So11111111111111111111111111111111111111112',
 *   inputAmount:  0.01,
 *   inputDecimals: 9,
 *   slippageBps:  100,
 *   fromPubkey:   new PublicKey(walletAddress),
 *   cluster:      'devnet',
 * });
 */
export async function swapOnOrca(params: OrcaSwapParams): Promise<OrcaResult> {
  const {
    poolAddress, inputMintAddress,
    inputAmount, inputDecimals,
    slippageBps, fromPubkey,
    cluster = 'devnet',
  } = params;

  // Uses the legacy SDK which works on devnet with a known pool address
  const { ctx, client, orca, common } = await buildLegacyContext(fromPubkey, cluster);
  const BN = await getBN();

  console.log('[OrcaSwap] Fetching pool and building swap quote...', {
    pool: poolAddress, inputMint: inputMintAddress, inputAmount, slippageBps,
  });

  const pool      = await client.getPool(new PublicKey(poolAddress));
  const inputMint = new PublicKey(inputMintAddress);
  const slippage  = common.Percentage.fromFraction(slippageBps, 10000);
  const amountBN  = new BN(Math.floor(inputAmount * 10 ** inputDecimals).toString());

  const quote = await orca.swapQuoteByInputToken(
    pool, inputMint, amountBN, slippage, ctx.program.programId, ctx.fetcher,
  );

  // Determine output token info for display
  const tokenA       = pool.getTokenAInfo();
  const tokenB       = pool.getTokenBInfo();
  const outputDec    = quote.aToB ? tokenB.decimals : tokenA.decimals;
  const estimatedOut = quote.estimatedAmountOut.toNumber() / 10 ** outputDec;

  console.log('[OrcaSwap] Quote received, executing swap...', {
    aToB: quote.aToB, estimatedOut,
  });

  const swapTxBuilder = await pool.swap(quote, fromPubkey);
  const txId = await (swapTxBuilder as any).buildAndExecute();

  console.log('[OrcaSwap] Real devnet swap confirmed:', txId);

  return {
    success: true,
    txId,
    mode: 'real',
    message: `Orca swap: ${inputAmount} → ~${estimatedOut.toFixed(4)} | tx: ${txId.slice(0, 16)}...`,
  };
}

// ── Open concentrated liquidity position (legacy SDK) ────────────────────────

export async function openOrcaPosition(params: OrcaPositionParams): Promise<OrcaResult> {
  const {
    poolAddress, lowerPrice, upperPrice,
    inputMintAddress, inputAmount, inputDecimals,
    slippageBps, fromPubkey,
    cluster = 'devnet',
  } = params;

  if (lowerPrice >= upperPrice) {
    throw new Error(`lowerPrice (${lowerPrice}) must be less than upperPrice (${upperPrice})`);
  }

  const { client, orca, common } = await buildLegacyContext(fromPubkey, cluster);
  const BN = await getBN();
  const { default: Decimal } = await import(/* @vite-ignore */ 'decimal.js');

  const pool   = await client.getPool(new PublicKey(poolAddress));
  const data   = pool.getData();
  const tokenA = pool.getTokenAInfo();
  const tokenB = pool.getTokenBInfo();

  const lowerTick = orca.PriceMath.priceToInitializableTickIndex(
    new Decimal(lowerPrice), tokenA.decimals, tokenB.decimals, data.tickSpacing,
  );
  const upperTick = orca.PriceMath.priceToInitializableTickIndex(
    new Decimal(upperPrice), tokenA.decimals, tokenB.decimals, data.tickSpacing,
  );

  if (lowerTick >= upperTick) {
    throw new Error(
      `Price range too narrow for tick spacing ${data.tickSpacing}. Try a wider range.`,
    );
  }

  const inputMint = new PublicKey(inputMintAddress);
  const amountBN  = new BN(Math.floor(inputAmount * 10 ** inputDecimals).toString());
  const slippage  = common.Percentage.fromFraction(slippageBps, 10000);

  const liquidityQuote = orca.increaseLiquidityQuoteByInputToken(
    inputMint, amountBN, lowerTick, upperTick, slippage, pool,
    orca.NO_TOKEN_EXTENSION_CONTEXT,
  );

  const { positionMint, tx } = await pool.openPosition(
    lowerTick, upperTick, liquidityQuote as any, fromPubkey,
  );
  const txId = await tx.buildAndExecute();

  return {
    success: true,
    txId,
    positionMint: positionMint.toBase58(),
    mode: 'real',
    message: `Orca position opened: $${lowerPrice}–$${upperPrice} | NFT: ${positionMint.toBase58().slice(0, 8)}... | tx: ${txId}`,
  };
}

// ── Close concentrated liquidity position (legacy SDK) ───────────────────────

export async function closeOrcaPosition(params: OrcaClosePositionParams): Promise<OrcaResult> {
  const { poolAddress, positionMint, slippageBps, fromPubkey, cluster = 'devnet' } = params;

  const { ctx, client, orca, common } = await buildLegacyContext(fromPubkey, cluster);

  const pool            = await client.getPool(new PublicKey(poolAddress));
  const positionMintKey = new PublicKey(positionMint);
  const positionPda     = orca.PDAUtil.getPosition(ctx.program.programId, positionMintKey);
  const slippage        = common.Percentage.fromFraction(slippageBps, 10000);

  const txBuilders = await pool.closePosition(
    positionPda.publicKey, slippage, fromPubkey, fromPubkey, fromPubkey,
  );

  const txIds: string[] = [];
  for (const builder of txBuilders) {
    txIds.push(await builder.buildAndExecute());
  }

  return {
    success: true,
    txId: txIds[txIds.length - 1],
    mode: 'real',
    message: `Orca position closed (${txIds.length} tx) | last tx: ${txIds[txIds.length - 1]}`,
  };
}

// ── Pool info & address utilities (legacy SDK) ────────────────────────────────

export async function getOrcaPoolInfo(
  poolAddress: string,
  fromPubkey: PublicKey,
  cluster: 'devnet' | 'mainnet-beta' = 'devnet',
): Promise<OrcaPoolInfo> {
  const { client, orca } = await buildLegacyContext(fromPubkey, cluster);

  const pool   = await client.getPool(new PublicKey(poolAddress));
  const data   = pool.getData();
  const tokenA = pool.getTokenAInfo();
  const tokenB = pool.getTokenBInfo();

  const currentPrice = orca.PriceMath.sqrtPriceX64ToPrice(
    data.sqrtPrice, tokenA.decimals, tokenB.decimals,
  ).toNumber();

  const feeRateBps = orca.PoolUtil.getFeeRate(data.feeRate).toDecimal().toNumber() * 10000;

  return {
    poolAddress,
    tokenA: { mint: tokenA.mint.toBase58(), symbol: tokenA.symbol, decimals: tokenA.decimals },
    tokenB: { mint: tokenB.mint.toBase58(), symbol: tokenB.symbol, decimals: tokenB.decimals },
    currentPrice,
    liquidity: data.liquidity.toString(),
    tickSpacing: data.tickSpacing,
    feeRateBps,
  };
}

export async function getOrcaPoolAddress(
  mintA: string,
  mintB: string,
  tickSpacing: number,
  cluster: 'devnet' | 'mainnet-beta' = 'devnet',
): Promise<string> {
  const { orca } = await loadLegacySDKs();
  const programId  = new PublicKey(ORCA_PROGRAM_ID);
  const configAddr = new PublicKey(ORCA_CONFIG[cluster]);

  const [orderedA, orderedB] = orca.PoolUtil.orderMints(
    new PublicKey(mintA), new PublicKey(mintB),
  );

  const pda = orca.PDAUtil.getWhirlpool(
    programId, configAddr,
    new PublicKey(orderedA.toString()),
    new PublicKey(orderedB.toString()),
    tickSpacing,
  );

  return pda.publicKey.toBase58();
}

export async function getOrcaPositions(
  fromPubkey: PublicKey,
  cluster: 'devnet' | 'mainnet-beta' = 'devnet',
): Promise<Array<{
  positionMint: string;
  positionAddress: string;
  poolAddress: string;
  lowerTick: number;
  upperTick: number;
  liquidity: string;
}>> {
  const { ctx, orca } = await buildLegacyContext(fromPubkey, cluster);

  const positions = await orca.getAllPositionAccountsByOwner({ ctx, owner: fromPubkey });

  return Object.values(positions as any).map((p: any) => ({
    positionMint:    p.positionMint?.toBase58()       ?? '',
    positionAddress: p.publicKey?.toBase58()           ?? '',
    poolAddress:     p.data?.whirlpool?.toBase58()     ?? '',
    lowerTick:       p.data?.tickLowerIndex            ?? 0,
    upperTick:       p.data?.tickUpperIndex            ?? 0,
    liquidity:       p.data?.liquidity?.toString()     ?? '0',
  }));
}
