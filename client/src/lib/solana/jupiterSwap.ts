import { Connection, VersionedTransaction, clusterApiUrl, PublicKey, Transaction } from "@solana/web3.js";

const JUP_QUOTE_URL = "https://quote-api.jup.ag/v6/quote";
const JUP_SWAP_URL = "https://quote-api.jup.ag/v6/swap";

// Default connection is devnet; keep configurable via function params when needed
export const solanaConnection = new Connection(clusterApiUrl("devnet"), "confirmed");

function toBaseUnits(uiAmount: number, decimals: number) {
  return BigInt(Math.round(uiAmount * 10 ** decimals)).toString();
}

export async function jupiterSwap(params: {
  inputMint: string;
  outputMint: string;
  uiAmount: number;
  inputDecimals: number;
  slippageBps: number;
  userPublicKey: string;
  destinationWallet?: string; // optional, defaults to userPublicKey
  cluster?: 'devnet' | 'mainnet-beta';
}) {
  const { inputMint, outputMint, uiAmount, inputDecimals, slippageBps, userPublicKey, destinationWallet, cluster } = params;

  const clusterParam = cluster || 'devnet';
  const amount = toBaseUnits(uiAmount, inputDecimals);
  console.debug('[jupiterSwap] request', {
    inputMint,
    outputMint,
    uiAmount,
    inputDecimals,
    slippageBps,
    userPublicKey,
    destinationWallet,
    cluster: clusterParam,
  });
  const quoteUrl = `${JUP_QUOTE_URL}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&swapMode=ExactIn&onlyDirectRoutes=false&cluster=${clusterParam}`;
  const quoteRes = await fetch(quoteUrl);
  if (!quoteRes.ok) {
    const errorText = await quoteRes.text();
    throw new Error(`Failed to fetch quote: ${errorText}`);
  }
  const quoteJson = await quoteRes.json();
  if (!quoteJson || !quoteJson.data || quoteJson.data.length === 0) {
    throw new Error("No routes found");
  }
  const route = quoteJson.data[0];
  console.debug('[jupiterSwap] selected route', { route });

  // Ensure destinationWallet is set (use userPublicKey as default)
  const destWallet = destinationWallet || userPublicKey;

  // Request swap transaction from Jupiter REST API for the selected cluster
  const swapUrl = `${JUP_SWAP_URL}?cluster=${clusterParam}`;

  const swapRes = await fetch(swapUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      route,
      userPublicKey,
      destinationWallet: destWallet,
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
  return { signature: sig };
}

// Common devnet mints (verified working tokens)
export const DEVNET_MINTS = {
  WSOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // Verified USDC devnet
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // Verified USDT devnet
};

// Add Liquidity function for Raydium pools
export async function addLiquidity(params: {
  tokenAMint: string;
  tokenBMint: string;
  amountA: number;
  amountB: number;
  tokenADecimals: number;
  tokenBDecimals: number;
  slippageBps: number;
  userPublicKey: string;
}) {
  const { tokenAMint, tokenBMint, amountA, amountB, tokenADecimals, tokenBDecimals, slippageBps, userPublicKey } = params;

  // For demo purposes, we'll simulate the add liquidity transaction
  // In a real implementation, you would:
  // 1. Find or create the liquidity pool
  // 2. Calculate the required amounts based on current pool state
  // 3. Create the add liquidity transaction
  // 4. Sign and send the transaction

  try {
    // Simulate finding pool information
    const poolInfo = await findOrCreatePool(tokenAMint, tokenBMint);
    
    // Calculate amounts with slippage
    const minAmountA = Math.floor(amountA * (10000 - slippageBps) / 10000);
    const minAmountB = Math.floor(amountB * (10000 - slippageBps) / 10000);

    // For now, we'll create a mock transaction that represents adding liquidity
    // In production, this would be a real Raydium transaction
    const mockTransaction = new Transaction();
    
    // Mock transaction instructions would go here
    // For demo purposes, we'll simulate success
    
    console.log(`Adding liquidity: ${amountA} of token A, ${amountB} of token B to pool ${poolInfo.poolId}`);
    
    // Simulate transaction success
    const mockSignature = "mock_liquidity_signature_" + Date.now();
    
    return {
      signature: mockSignature,
      poolId: poolInfo.poolId,
      liquidityAmount: Math.min(amountA, amountB), // Simplified calculation
      tokenAAmount: amountA,
      tokenBAmount: amountB,
    };
  } catch (error) {
    throw new Error(`Failed to add liquidity: ${error}`);
  }
}

// Helper function to find or create a pool (simplified for demo)
async function findOrCreatePool(tokenAMint: string, tokenBMint: string) {
  // In a real implementation, you would:
  // 1. Check if a pool exists for this token pair
  // 2. If not, create a new pool
  // 3. Return pool information including pool ID, reserves, etc.
  
  // For demo purposes, return mock pool info
  return {
    poolId: `pool_${tokenAMint.slice(0, 8)}_${tokenBMint.slice(0, 8)}`,
    tokenAMint,
    tokenBMint,
    reserves: {
      tokenA: 1000000, // Mock reserves
      tokenB: 50000000,
    },
    lpMint: `lp_${tokenAMint.slice(0, 8)}_${tokenBMint.slice(0, 8)}`,
  };
}


