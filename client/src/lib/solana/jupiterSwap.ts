import { Connection, VersionedTransaction, clusterApiUrl } from "@solana/web3.js";
import { executeMockSwap } from './mockJupiterService';
import { getDevnetTokenByAddress } from './jupiterDevnetUtils';

const JUP_QUOTE_URL = "https://quote-api.jup.ag/v6/quote";
const JUP_SWAP_URL = "https://quote-api.jup.ag/v6/swap";

// Default connection is devnet; keep configurable via function params when needed
export const solanaConnection = new Connection(clusterApiUrl("devnet"), "confirmed");

function toBaseUnits(uiAmount: number, decimals: number) {
  return BigInt(Math.round(uiAmount * 10 ** decimals)).toString();
}

/**
 * Get current cluster from environment
 */
function getCluster(): 'devnet' | 'mainnet-beta' {
  const rpcUrl = typeof process !== 'undefined' ? (process.env?.VITE_SOLANA_RPC_URL || '') : '';
  if (rpcUrl.includes('mainnet') || rpcUrl.includes('api.mainnet')) {
    return 'mainnet-beta';
  }
  return 'devnet';
}

export interface SwapParams {
  inputMint: string;
  outputMint: string;
  uiAmount: number;
  inputDecimals: number;
  outputDecimals?: number;
  slippageBps: number;
  userPublicKey: string;
  destinationWallet?: string;
  cluster?: 'devnet' | 'mainnet-beta';
  forceMock?: boolean; // Force mock mode even on mainnet (for testing)
}

export interface SwapResult {
  signature: string;
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount?: number;
  mode: 'real' | 'mock';
  message?: string;
}

/**
 * Smart Jupiter swap function
 * - Uses mock swap on devnet (Jupiter doesn't fully work there)
 * - Uses real Jupiter on mainnet
 */
export async function jupiterSwap(params: SwapParams): Promise<SwapResult> {
  const {
    inputMint,
    outputMint,
    uiAmount,
    inputDecimals,
    outputDecimals,
    slippageBps,
    userPublicKey,
    destinationWallet,
    cluster,
    forceMock
  } = params;

  const clusterParam = cluster || getCluster();

  console.debug('[jupiterSwap] request', {
    inputMint,
    outputMint,
    uiAmount,
    inputDecimals,
    slippageBps,
    userPublicKey,
    destinationWallet,
    cluster: clusterParam,
    forceMock,
  });

  // Use mock swap on devnet or if forced
  if (clusterParam === 'devnet' || forceMock) {
    // ── CPMM path: check if a real Raydium pool exists for this pair ──────────
    // This covers custom tokens the user created and pooled via createCustomTokenPool()
    if (!forceMock) {
      const { getCustomPoolByMints, swapInCpmmPool } = await import('./raydiumDevnet');
      const cpmmPool = getCustomPoolByMints(inputMint, outputMint);
      if (cpmmPool) {
        console.log('[jupiterSwap] Found custom CPMM pool — using real devnet swap');
        try {
          const result = await swapInCpmmPool({
            poolId: cpmmPool.poolId,
            inputMintAddress: inputMint,
            inputAmount: uiAmount,
            inputDecimals,
            slippageBps,
            fromPubkey: new (await import('@solana/web3.js').then(m => m.PublicKey))(userPublicKey),
          });
          return {
            signature: result.txId,
            inputMint,
            outputMint,
            inputAmount: uiAmount,
            mode: 'real',
            message: result.message,
          };
        } catch (error: any) {
          console.warn('[jupiterSwap] CPMM swap failed, falling back to mock:', error?.message);
          // fall through to mock swap below
        }
      }
    }

    // ── Mock path: standard devnet tokens (SOL, USDC, USDT, BONK) ────────────
    console.log('[jupiterSwap] Using mock swap for devnet...');

    // Get output decimals from token info if not provided
    const outputToken = getDevnetTokenByAddress(outputMint);
    const outDecimals = outputDecimals || outputToken?.decimals || 6;

    try {
      const result = await executeMockSwap({
        inputMint,
        outputMint,
        uiAmount,
        inputDecimals,
        outputDecimals: outDecimals,
        slippageBps,
        userPublicKey,
      });

      return {
        signature: result.signature,
        inputMint: result.inputMint,
        outputMint: result.outputMint,
        inputAmount: result.inputAmount,
        outputAmount: result.outputAmount,
        mode: 'mock',
        message: result.message,
      };
    } catch (error: any) {
      console.error('[jupiterSwap] Mock swap failed:', error);
      throw new Error(`Mock swap failed: ${error?.message || String(error)}`);
    }
  }

  // Mainnet: Use real Jupiter API
  console.log('[jupiterSwap] Using real Jupiter API for mainnet...');

  const amount = toBaseUnits(uiAmount, inputDecimals);
  const quoteUrl = `${JUP_QUOTE_URL}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&swapMode=ExactIn&onlyDirectRoutes=false`;

  const quoteRes = await fetch(quoteUrl);
  if (!quoteRes.ok) {
    const errorText = await quoteRes.text();
    throw new Error(`Failed to fetch quote: ${errorText}`);
  }

  // Jupiter v6 returns the quote object directly (not wrapped in .data[])
  const quoteResponse = await quoteRes.json();
  if (!quoteResponse || quoteResponse.error) {
    throw new Error(quoteResponse?.error || 'No routes found');
  }

  console.debug('[jupiterSwap] quote response', { quoteResponse });

  // Request swap transaction from Jupiter REST API
  const swapRes = await fetch(JUP_SWAP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse,          // Jupiter v6: use quoteResponse, not route
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });

  if (!swapRes.ok) {
    const t = await swapRes.text();
    throw new Error(`Swap tx build failed: ${t}`);
  }

  const { swapTransaction } = await swapRes.json();
  console.debug('[jupiterSwap] received swapTransaction (base64 length)', swapTransaction?.length);
  if (!swapTransaction) throw new Error("No swapTransaction returned");

  // Convert base64 -> Uint8Array for browser-friendly deserialization
  const base64ToUint8Array = (b64: string) => {
    const binary = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };

  const txBuf = base64ToUint8Array(swapTransaction);
  const tx = VersionedTransaction.deserialize(txBuf as any);

  const provider: any = (window as any)?.solana;
  if (!provider?.isPhantom) throw new Error("Phantom not available");

  // Some wallet adapters expose signAndSendTransaction for VersionedTransaction.
  // Fallback to signTransaction + sendRawTransaction if needed.
  let sig: string;
  if (typeof provider.signAndSendTransaction === 'function') {
    const signed = await provider.signAndSendTransaction(tx as any);
    sig = signed?.signature || signed;
  } else if (typeof provider.signTransaction === 'function') {
    // provider.signTransaction may return a signed VersionedTransaction
    const signedTx = await provider.signTransaction(tx as any);
    const raw = signedTx.serialize(); // Uint8Array
    sig = await solanaConnection.sendRawTransaction(raw as any, { skipPreflight: false, preflightCommitment: 'confirmed' });
  } else {
    throw new Error('Wallet does not support transaction signing');
  }

  console.debug('[jupiterSwap] sent transaction signature', sig);
  await solanaConnection.confirmTransaction(sig, "confirmed");

  return {
    signature: sig,
    inputMint,
    outputMint,
    inputAmount: uiAmount,
    mode: 'real',
    message: `Swap completed successfully`,
  };
}

// Common devnet mints (verified working tokens)
export const DEVNET_MINTS = {
  WSOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // Verified USDC devnet
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // Verified USDT devnet
};


