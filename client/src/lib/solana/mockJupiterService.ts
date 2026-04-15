/**
 * Mock Jupiter Service for Devnet Testing
 * Simulates Jupiter aggregator functionality when real Jupiter is unavailable
 */

import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js';
import { getDevnetTokenByAddress, getDevnetExchangeRate, isDevnetPairAvailable, getDevnetExchangeRateLive } from './jupiterDevnetUtils';
import { validateDevnetTokenPair } from './devnetValidator';

const isBrowser = typeof window !== 'undefined';

export interface MockSwapParams {
  inputMint: string;
  outputMint: string;
  uiAmount: number;
  inputDecimals: number;
  outputDecimals: number;
  slippageBps: number;
  userPublicKey: string;
}

export interface MockSwapQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  outputAmountWithSlippage: string;
  priceImpact: number;
  exchangeRate: number;
  fee: number;
  route: string[];
}

export interface MockSwapResult {
  success: boolean;
  signature: string;
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  mode: 'mock';
  message: string;
}

// Mock pool reserves for price simulation
const MOCK_POOL_RESERVES: Record<string, { reserveA: number; reserveB: number }> = {
  'SOL/USDC': { reserveA: 100000, reserveB: 15000000 },   // ~$150/SOL
  'SOL/USDT': { reserveA: 100000, reserveB: 15000000 },   // ~$150/SOL
  'SOL/BONK': { reserveA: 1000, reserveB: 15000000000 },  // SOL/BONK
  'USDC/USDT': { reserveA: 10000000, reserveB: 10000000 }, // 1:1 stables
};

/**
 * Get mock swap quote
 */
export function getMockSwapQuote(params: MockSwapParams): MockSwapQuote {
  const { inputMint, outputMint, uiAmount, inputDecimals, outputDecimals, slippageBps } = params;

  const inputToken = getDevnetTokenByAddress(inputMint) ?? {
    symbol: `${inputMint.slice(0, 4)}...${inputMint.slice(-4)}`,
  };
  const outputToken = getDevnetTokenByAddress(outputMint) ?? {
    symbol: `${outputMint.slice(0, 4)}...${outputMint.slice(-4)}`,
  };

  // Calculate exchange rate using mock prices
  const exchangeRate = getDevnetExchangeRate(inputMint, outputMint) || 1;

  if (exchangeRate === 1) {
    console.warn(
      `[MockJupiter] No mock price for ${inputMint} -> ${outputMint}; using neutral 1:1 fallback quote.`,
    );
  }

  // Calculate output amount
  const rawOutputAmount = uiAmount * exchangeRate;

  // Apply 0.3% swap fee (like Uniswap/Jupiter)
  const feePercent = 0.003;
  const outputAmountAfterFee = rawOutputAmount * (1 - feePercent);

  // Calculate slippage
  const slippageDecimal = slippageBps / 10000;
  const outputAmountWithSlippage = outputAmountAfterFee * (1 - slippageDecimal);

  // Calculate price impact (mock - based on trade size relative to pool)
  const priceImpact = Math.min((uiAmount / 1000) * 0.1, 5); // Max 5% impact

  // Convert to base units
  const inputAmount = BigInt(Math.floor(uiAmount * 10 ** inputDecimals)).toString();
  const outputAmount = BigInt(Math.floor(outputAmountAfterFee * 10 ** outputDecimals)).toString();
  const outputWithSlip = BigInt(Math.floor(outputAmountWithSlippage * 10 ** outputDecimals)).toString();

  return {
    inputMint,
    outputMint,
    inputAmount,
    outputAmount,
    outputAmountWithSlippage: outputWithSlip,
    priceImpact,
    exchangeRate,
    fee: feePercent * 100, // percentage
    route: [inputToken.symbol, outputToken.symbol],
  };
}

/**
 * Execute mock swap on devnet
 * This simulates a swap by creating a mock transaction
 */
export async function executeMockSwap(params: MockSwapParams): Promise<MockSwapResult> {
  const { inputMint, outputMint, uiAmount, slippageBps, userPublicKey } = params;

  // Validate token pair
  const validation = validateDevnetTokenPair(inputMint, outputMint);
  if (!validation.valid) {
    throw new Error(validation.reason || 'Invalid token pair');
  }

  // Log any warnings
  validation.warnings.forEach(warning => console.warn('[MockJupiter]', warning));

  // Check if pair is available
  if (!isDevnetPairAvailable(inputMint, outputMint)) {
    throw new Error(`Trading pair not available on devnet: ${inputMint} -> ${outputMint}`);
  }

  // Resolve exchange rate: try live Jupiter price feed, fall back to hardcoded mock
  let exchangeRate: number;
  let rateSource: 'live' | 'mock';
  try {
    const live = await getDevnetExchangeRateLive(inputMint, outputMint);
    if (live > 0) { exchangeRate = live; rateSource = 'live'; }
    else { exchangeRate = getDevnetExchangeRate(inputMint, outputMint); rateSource = 'mock'; }
  } catch {
    exchangeRate = getDevnetExchangeRate(inputMint, outputMint);
    rateSource = 'mock';
  }

  // Compute output using resolved rate (0.3 % fee + slippage)
  const feeAdjusted = uiAmount * exchangeRate * (1 - 0.003);
  const liveOutputUi = feeAdjusted * (1 - slippageBps / 10_000);

  // Keep static quote for route / priceImpact display metadata
  const quote = getMockSwapQuote(params);

  const inputToken = getDevnetTokenByAddress(inputMint);
  const outputToken = getDevnetTokenByAddress(outputMint);

  console.log('[MockJupiter] Executing mock swap:', {
    from: inputToken?.symbol,
    to: outputToken?.symbol,
    inputAmount: uiAmount,
    expectedOutput: liveOutputUi,
    exchangeRate,
    rateSource,
    priceImpact: quote.priceImpact,
  });

  // Check wallet availability (browser only)
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

    // Create a simple transfer transaction to simulate the swap
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const fromPubkey = new PublicKey(userPublicKey);

    // Check balance
    const balance = await connection.getBalance(fromPubkey);
    const requiredLamports = inputMint === 'So11111111111111111111111111111111111111112'
      ? Math.floor(uiAmount * LAMPORTS_PER_SOL) + 5000 // SOL + fees
      : 5000; // Just fees for token swaps

    if (balance < requiredLamports) {
      throw new Error(`Insufficient SOL balance. Need ${requiredLamports / LAMPORTS_PER_SOL} SOL`);
    }

    // For mock purposes, we'll create a memo transaction
    // In a real swap, this would be a complex transaction with token transfers
    const transaction = new Transaction();

    // Add a minimal transfer to self to create a valid transaction
    transaction.add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey: fromPubkey,
        lamports: 1, // Minimal amount
      })
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    console.log('[MockJupiter] Requesting signature from wallet...');

    // Sign and send transaction
    const txResult = await provider.signAndSendTransaction(transaction);
    const signature = typeof txResult === 'string'
      ? txResult
      : (txResult?.signature || txResult?.txid);

    if (!signature) {
      throw new Error('Failed to get transaction signature');
    }

    console.log('[MockJupiter] Transaction sent:', signature);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    const outputAmountUi = liveOutputUi;

    console.log('[MockJupiter] Mock swap completed!');
    console.log(`Swapped ${uiAmount} ${inputToken?.symbol} for ~${outputAmountUi.toFixed(4)} ${outputToken?.symbol} (rate source: ${rateSource})`);

    return {
      success: true,
      signature,
      inputMint,
      outputMint,
      inputAmount: uiAmount,
      outputAmount: outputAmountUi,
      mode: 'mock',
      message: `Successfully swapped ${uiAmount} ${inputToken?.symbol} for ~${outputAmountUi.toFixed(4)} ${outputToken?.symbol} (Mock)`,
    };
  } else {
    // Server-side mock (no wallet needed)
    const mockSignature = 'mock_swap_' + Math.random().toString(36).substring(2, 18) + Date.now().toString(36);
    const outputAmountUi = liveOutputUi;

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    return {
      success: true,
      signature: mockSignature,
      inputMint,
      outputMint,
      inputAmount: uiAmount,
      outputAmount: outputAmountUi,
      mode: 'mock',
      message: `Successfully swapped ${uiAmount} ${inputToken?.symbol} for ~${outputAmountUi.toFixed(4)} ${outputToken?.symbol} (Mock)`,
    };
  }
}

/**
 * Get mock token balance (simulated)
 */
export async function getMockTokenBalance(
  userPublicKey: string,
  mintAddress: string
): Promise<number> {
  if (!isBrowser) {
    // Server-side mock balance
    return mintAddress === 'So11111111111111111111111111111111111111112' ? 10.0 : 1000.0;
  }

  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  const pubkey = new PublicKey(userPublicKey);

  // For SOL, get actual balance
  if (mintAddress === 'So11111111111111111111111111111111111111112') {
    const balance = await connection.getBalance(pubkey);
    return balance / LAMPORTS_PER_SOL;
  }

  // For other tokens, return mock balance
  const token = getDevnetTokenByAddress(mintAddress);
  if (!token) {
    return 0;
  }

  // Return mock balances based on token type
  switch (token.symbol) {
    case 'USDC':
    case 'USDT':
      return 1000.0; // Mock 1000 stablecoins
    case 'BONK':
      return 10000000.0; // Mock 10M BONK
    default:
      return 100.0;
  }
}

/**
 * Get mock swap routes (for display purposes)
 */
export function getMockSwapRoutes(inputMint: string, outputMint: string): string[][] {
  const inputToken = getDevnetTokenByAddress(inputMint);
  const outputToken = getDevnetTokenByAddress(outputMint);

  if (!inputToken || !outputToken) {
    return [];
  }

  // Direct route
  const routes: string[][] = [[inputToken.symbol, outputToken.symbol]];

  // Add multi-hop routes through SOL if not already SOL
  if (inputToken.symbol !== 'SOL' && outputToken.symbol !== 'SOL') {
    routes.push([inputToken.symbol, 'SOL', outputToken.symbol]);
  }

  // Add multi-hop through USDC for non-stable pairs
  if (inputToken.symbol !== 'USDC' && outputToken.symbol !== 'USDC') {
    routes.push([inputToken.symbol, 'USDC', outputToken.symbol]);
  }

  return routes;
}
