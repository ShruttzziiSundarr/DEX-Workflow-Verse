/**
 * Orca Whirlpools CLMM integration — real on-chain operations
 *
 * Whirlpools are Orca's concentrated liquidity pools (similar to Uniswap v3):
 *  - Liquidity providers choose a price RANGE instead of the full curve
 *  - Capital is more efficient within the range, earning higher fees
 *  - Positions are represented as NFTs
 *
 * Supports:
 *  - Swap tokens in an existing Whirlpool
 *  - Open a concentrated liquidity position (add LP)
 *  - Close a position (withdraw LP + collect fees)
 *  - Query pool info (current price, tick spacing, fee rate)
 *  - Compute pool address from mint pair + tick spacing
 *
 * Program ID: whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc  (same devnet + mainnet)
 * Devnet config: FcrweFY1G9HJAHG5inkGB6pKg1HZ6x9UC2WioAfWrGkR
 * Mainnet config: 2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ  (= ORCA_WHIRLPOOLS_CONFIG)
 *
 * References:
 *  https://github.com/orca-so/whirlpools/tree/main/legacy-sdk/whirlpool/src
 *  https://orca-so.gitbook.io/orca-developer-portal/whirlpools
 */

import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const ORCA_PROGRAM_ID  = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
// Orca whirlpools configs (the top-level account that owns all pools)
const ORCA_CONFIG = {
  'mainnet-beta': '2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ',
  devnet:         'FcrweFY1G9HJAHG5inkGB6pKg1HZ6x9UC2WioAfWrGkR',
} as const;

/**
 * Standard Orca fee tier → tick spacing mapping.
 * Tick spacing determines which fee tier a pool belongs to.
 *   1   = 0.01%  (stable pairs e.g. USDC/USDT)
 *   8   = 0.04%  (very tight ranges)
 *   16  = 0.05%  (stable-ish)
 *   64  = 0.30%  (standard)
 *   128 = 1.00%  (volatile)
 */
export const ORCA_TICK_SPACINGS = {
  ULTRA_STABLE: 1,
  STABLE:       8,
  TIGHT:        16,
  STANDARD:     64,
  VOLATILE:     128,
} as const;

// Dynamic import handles — avoids large bundle impact when Orca isn't used
const ORCA_SDK    = '@orca-so/whirlpools-sdk';
const ORCA_COMMON = '@orca-so/common-sdk';
const ANCHOR_SDK  = '@coral-xyz/anchor';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrcaSwapParams {
  /** Whirlpool pool address. Compute with getOrcaPoolAddress() or look up via Orca UI. */
  poolAddress: string;
  inputMintAddress: string;
  /** Amount to sell, in UI (human-readable) units */
  inputAmount: number;
  inputDecimals: number;
  /** Slippage tolerance in basis points: 100 = 1 % */
  slippageBps: number;
  fromPubkey: PublicKey;
  cluster?: 'devnet' | 'mainnet-beta';
}

export interface OrcaPositionParams {
  poolAddress: string;
  /**
   * Lower bound of the price range.
   * Expressed as tokenB per tokenA (e.g. if pool is SOL/USDC, price = USD per SOL).
   */
  lowerPrice: number;
  /** Upper bound of the price range. Must be greater than lowerPrice. */
  upperPrice: number;
  /** Which token side you are specifying exactly (the SDK calculates the other side). */
  inputMintAddress: string;
  inputAmount: number;
  inputDecimals: number;
  slippageBps: number;
  fromPubkey: PublicKey;
  cluster?: 'devnet' | 'mainnet-beta';
}

export interface OrcaClosePositionParams {
  poolAddress: string;
  /** The position NFT mint returned by openOrcaPosition(). */
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
  /** Current price expressed as tokenB per tokenA */
  currentPrice: number;
  liquidity: string;
  tickSpacing: number;
  /** Fee rate in basis points */
  feeRateBps: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function phantom() {
  if (typeof window === 'undefined') throw new Error('Browser environment required');
  const p: any = (window as any)?.solana;
  if (!p?.isPhantom) throw new Error('Phantom wallet not found');
  await p.connect({ onlyIfTrusted: true }).catch(() => {
    throw new Error('Wallet not connected — connect Phantom first');
  });
  return p;
}

async function loadSDKs() {
  const [orca, common, anchor] = await Promise.all([
    import(/* @vite-ignore */ ORCA_SDK),
    import(/* @vite-ignore */ ORCA_COMMON),
    import(/* @vite-ignore */ ANCHOR_SDK),
  ]);
  return { orca, common, anchor };
}

async function getBN() {
  const m = await import(/* @vite-ignore */ 'bn.js');
  return (m.default ?? m) as any;
}

/**
 * Build a WhirlpoolContext wired to Phantom.
 * AnchorProvider wraps Phantom's signAllTransactions so
 * TransactionBuilder.buildAndExecute() works in the browser.
 */
async function buildContext(fromPubkey: PublicKey, cluster: 'devnet' | 'mainnet-beta') {
  const provider = await phantom();
  const { orca, common, anchor } = await loadSDKs();
  const connection = new Connection(clusterApiUrl(cluster), 'confirmed');

  const anchorWallet = {
    publicKey: fromPubkey,
    signTransaction:    (tx: any)    => provider.signTransaction(tx),
    signAllTransactions:(txs: any[]) => provider.signAllTransactions(txs),
  };

  const anchorProvider = new anchor.AnchorProvider(connection, anchorWallet as any, {
    commitment: 'confirmed',
    skipPreflight: false,
  });

  const programId = new PublicKey(ORCA_PROGRAM_ID);
  const ctx    = orca.WhirlpoolContext.withProvider(anchorProvider, programId);
  const client = orca.buildWhirlpoolClient(ctx);

  return { ctx, client, orca, common, anchor, connection };
}

// ── Swap ──────────────────────────────────────────────────────────────────────

/**
 * Swap tokens in an existing Orca Whirlpool.
 *
 * Unlike Raydium CPMM, Whirlpools are concentrated-liquidity pools — liquidity
 * is only active within configured price ranges, which can affect price impact.
 *
 * Finding a pool address:
 *   const addr = await getOrcaPoolAddress(mintA, mintB, 64, 'devnet');
 *
 * @example
 * await swapOnOrca({
 *   poolAddress: '3KBZiL2g8C7tiZ1QoGBSoQ15P3f5psTAfzaTJXB3EFB', // SOL/USDC devnet
 *   inputMintAddress: 'So11111111111111111111111111111111111111112',
 *   inputAmount: 0.1,
 *   inputDecimals: 9,
 *   slippageBps: 100,
 *   fromPubkey: new PublicKey(walletAddress),
 * });
 */
export async function swapOnOrca(params: OrcaSwapParams): Promise<OrcaResult> {
  const {
    poolAddress, inputMintAddress,
    inputAmount, inputDecimals,
    slippageBps, fromPubkey,
    cluster = 'devnet',
  } = params;

  const { ctx, client, orca, common } = await buildContext(fromPubkey, cluster);
  const BN = await getBN();

  const pool       = await client.getPool(new PublicKey(poolAddress));
  const inputMint  = new PublicKey(inputMintAddress);
  const amountBN   = new BN(Math.floor(inputAmount * 10 ** inputDecimals).toString());
  const slippage   = common.Percentage.fromFraction(slippageBps, 10000);

  const quote = await orca.swapQuoteByInputToken(
    pool, inputMint, amountBN, slippage,
    ctx.program.programId,
    ctx.fetcher,
    orca.IGNORE_CACHE,
  );

  const txBuilder = await pool.swap(quote, fromPubkey);
  const txId = await txBuilder.buildAndExecute();

  // Build result message
  const tokenA   = pool.getTokenAInfo();
  const tokenB   = pool.getTokenBInfo();
  const isAtoB   = tokenA.mint.toBase58() === inputMintAddress;
  const outToken = isAtoB ? tokenB : tokenA;
  const outAmt   = (quote.estimatedAmountOut.toNumber() / 10 ** outToken.decimals).toFixed(6);
  const outSym   = outToken.symbol || outToken.mint.toBase58().slice(0, 8);

  return {
    success: true,
    txId,
    mode: 'real',
    message: `Orca swap: ${inputAmount} → ~${outAmt} ${outSym} | tx: ${txId}`,
  };
}

// ── Open concentrated liquidity position ─────────────────────────────────────

/**
 * Open a concentrated liquidity position in an Orca Whirlpool.
 *
 * You define a price range [lowerPrice, upperPrice].  The SDK places your
 * liquidity only within that range — you earn trading fees whenever the
 * current price sits inside your range.
 *
 * Returns the position NFT mint address — save it to close the position later.
 *
 * @example
 * const result = await openOrcaPosition({
 *   poolAddress: '3KBZiL2g8C7tiZ1QoGBSoQ15P3f5psTAfzaTJXB3EFB',
 *   lowerPrice: 130,    // $130 per SOL
 *   upperPrice: 170,    // $170 per SOL
 *   inputMintAddress: 'So11111111111111111111111111111111111111112',
 *   inputAmount: 0.5,   // 0.5 SOL
 *   inputDecimals: 9,
 *   slippageBps: 100,
 *   fromPubkey: new PublicKey(walletAddress),
 * });
 * console.log('Position NFT:', result.positionMint);
 */
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

  const { client, orca, common } = await buildContext(fromPubkey, cluster);
  const BN = await getBN();
  const { default: Decimal } = await import(/* @vite-ignore */ 'decimal.js');

  const pool     = await client.getPool(new PublicKey(poolAddress));
  const data     = pool.getData();
  const tokenA   = pool.getTokenAInfo();
  const tokenB   = pool.getTokenBInfo();

  // Convert UI prices → initializable tick indices for this pool's tick spacing
  const lowerTick = orca.PriceMath.priceToInitializableTickIndex(
    new Decimal(lowerPrice), tokenA.decimals, tokenB.decimals, data.tickSpacing,
  );
  const upperTick = orca.PriceMath.priceToInitializableTickIndex(
    new Decimal(upperPrice), tokenA.decimals, tokenB.decimals, data.tickSpacing,
  );

  if (lowerTick >= upperTick) {
    throw new Error(
      `Price range too narrow for tick spacing ${data.tickSpacing}. ` +
      `Try a wider range (e.g. ±10% around current price).`,
    );
  }

  const inputMint = new PublicKey(inputMintAddress);
  const amountBN  = new BN(Math.floor(inputAmount * 10 ** inputDecimals).toString());
  const slippage  = common.Percentage.fromFraction(slippageBps, 10000);

  // Compute how much liquidity this input provides within the price range
  const liquidityQuote = orca.increaseLiquidityQuoteByInputToken(
    inputMint, amountBN, lowerTick, upperTick, slippage, pool,
  );

  // Open position — mints a position NFT + deposits liquidity
  const { positionMint, tx } = await pool.openPosition(
    lowerTick, upperTick, liquidityQuote, fromPubkey,
  );

  const txId = await tx.buildAndExecute();

  return {
    success: true,
    txId,
    positionMint: positionMint.toBase58(),
    mode: 'real',
    message: `Orca position opened: $${lowerPrice}–$${upperPrice} | ` +
             `NFT: ${positionMint.toBase58().slice(0, 8)}... | tx: ${txId}`,
  };
}

// ── Close concentrated liquidity position ────────────────────────────────────

/**
 * Close an Orca Whirlpool position and withdraw all tokens + accumulated fees.
 *
 * `positionMint` is the NFT mint returned by openOrcaPosition().
 * Closing may require up to 2 transactions (collect fees/rewards, then close).
 *
 * @example
 * await closeOrcaPosition({
 *   poolAddress: '3KBZiL2...',
 *   positionMint: 'THE_NFT_MINT_FROM_OPEN',
 *   slippageBps: 100,
 *   fromPubkey: new PublicKey(walletAddress),
 * });
 */
export async function closeOrcaPosition(params: OrcaClosePositionParams): Promise<OrcaResult> {
  const { poolAddress, positionMint, slippageBps, fromPubkey, cluster = 'devnet' } = params;

  const { ctx, client, orca, common } = await buildContext(fromPubkey, cluster);

  const pool             = await client.getPool(new PublicKey(poolAddress));
  const positionMintKey  = new PublicKey(positionMint);

  // Derive the position account PDA from the NFT mint
  const positionPda = orca.PDAUtil.getPosition(ctx.program.programId, positionMintKey);
  const slippage    = common.Percentage.fromFraction(slippageBps, 10000);

  // closePosition returns TransactionBuilder[] — there may be 1 or 2 txs
  // (one to collect fees/rewards, one to close and burn the NFT)
  const txBuilders = await pool.closePosition(
    positionPda.publicKey,
    slippage,
    fromPubkey,   // destination wallet for withdrawn tokens
    fromPubkey,   // position wallet (owner of the NFT)
    fromPubkey,   // fee payer
  );

  const txIds: string[] = [];
  for (const builder of txBuilders) {
    const txId = await builder.buildAndExecute();
    txIds.push(txId);
  }

  return {
    success: true,
    txId: txIds[txIds.length - 1],
    mode: 'real',
    message: `Orca position closed (${txIds.length} tx) | last tx: ${txIds[txIds.length - 1]}`,
  };
}

// ── Pool info & address utilities ─────────────────────────────────────────────

/**
 * Fetch live pool state: current price, liquidity, tick spacing, fee rate.
 */
export async function getOrcaPoolInfo(
  poolAddress: string,
  fromPubkey: PublicKey,
  cluster: 'devnet' | 'mainnet-beta' = 'devnet',
): Promise<OrcaPoolInfo> {
  const { client, orca } = await buildContext(fromPubkey, cluster);
  const { default: Decimal } = await import(/* @vite-ignore */ 'decimal.js');

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

/**
 * Compute the canonical Orca Whirlpool address for a token pair and tick spacing.
 * The address is deterministic — no RPC call needed.
 *
 * Orca orders token mints lexicographically (lower address = tokenA).
 * Use `tickSpacing = 64` (STANDARD) for most pairs.
 *
 * @example
 * const poolAddr = await getOrcaPoolAddress(
 *   'So11111111111111111111111111111111111111112',  // SOL
 *   '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // USDC devnet
 *   64, // standard fee tier
 *   'devnet',
 * );
 */
export async function getOrcaPoolAddress(
  mintA: string,
  mintB: string,
  tickSpacing: number,
  cluster: 'devnet' | 'mainnet-beta' = 'devnet',
): Promise<string> {
  const { orca } = await loadSDKs();
  const programId  = new PublicKey(ORCA_PROGRAM_ID);
  const configAddr = new PublicKey(ORCA_CONFIG[cluster]);

  // Orca orders mints: sort them so mintA < mintB
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

/**
 * List all open Orca positions for a wallet.
 * Returns position mints and their pool associations.
 */
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
  const { ctx, orca } = await buildContext(fromPubkey, cluster);

  const positions = await orca.getAllPositionAccountsByOwner({
    ctx,
    owner: fromPubkey,
  });

  return positions.map((p: any) => ({
    positionMint:    p.positionMint?.toBase58() ?? '',
    positionAddress: p.publicKey?.toBase58()    ?? '',
    poolAddress:     p.data?.whirlpool?.toBase58() ?? '',
    lowerTick:       p.data?.tickLowerIndex ?? 0,
    upperTick:       p.data?.tickUpperIndex ?? 0,
    liquidity:       p.data?.liquidity?.toString() ?? '0',
  }));
}
