import { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js';

type Cluster = 'mainnet-beta' | 'devnet';

interface MarinadeStakeParams {
  action: 'stake' | 'unstake' | 'liquidUnstake';
  amount?: number; // SOL amount for stake, mSOL amount for unstake
  fromPubkey: PublicKey;
  stakeAccountPubkey?: string; // For unstake (ticket address)
}

interface StakeResult {
  ok: boolean;
  txSig: string;
  msolAccount?: string;
  mode: 'real' | 'mock';
}

/**
 * Get the current cluster from connection or environment
 */
function getCluster(): Cluster {
  // In Vite, use import.meta.env; process.env doesn't exist in browser
  const rpcUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SOLANA_RPC_URL) || '';
  if (rpcUrl.includes('mainnet') || rpcUrl.includes('api.mainnet')) {
    return 'mainnet-beta';
  }
  // Default to devnet for safety
  return 'devnet';
}

/**
 * Get connection for the cluster
 */
function getConnection(cluster: Cluster): Connection {
  return new Connection(clusterApiUrl(cluster), 'confirmed');
}

/**
 * Smart Marinade staking service
 * - Mocks on devnet (Marinade doesn't exist there)
 * - Uses real Marinade SDK on mainnet
 */
export async function handleMarinadeStake({
  action,
  amount,
  fromPubkey,
  stakeAccountPubkey,
}: MarinadeStakeParams): Promise<string> {
  const cluster = getCluster();
  const connection = getConnection(cluster);
  const provider: any = (window as any)?.solana;
  
  if (!provider?.isPhantom) {
    throw new Error('Phantom wallet not available');
  }

  // Check wallet connection
  const isConnected = await provider.connect({ onlyIfTrusted: true }).catch(() => false);
  if (!isConnected) {
    throw new Error('Wallet not connected. Please connect your wallet and try again.');
  }

  // DEVNET: Mock staking (Marinade doesn't exist on devnet)
  if (cluster === 'devnet') {
    console.log('[Marinade][MOCK] Staking on devnet - using native Solana staking as fallback');
    
    if (action === 'stake') {
      if (!amount || amount <= 0) {
        throw new Error('Amount is required for staking');
      }

      // Use native Solana staking as fallback on devnet
      const { handleSolanaStake } = await import('./solanaStaking');
      const signature = await handleSolanaStake({
        action: 'delegate',
        amount,
        validatorPubkey: undefined, // Auto-select validator
        fromPubkey,
      });

      console.log('[Marinade][MOCK] Devnet staking completed (using native staking):', signature);
      return signature;
    } else {
      // For unstake on devnet, use native unstaking
      if (!stakeAccountPubkey) {
        throw new Error('Stake account is required for unstaking');
      }

      const { handleSolanaStake } = await import('./solanaStaking');
      const signature = await handleSolanaStake({
        action: 'deactivate',
        stakeAccountPubkey,
        fromPubkey,
      });

      console.log('[Marinade][MOCK] Devnet unstaking completed (using native staking):', signature);
      return signature;
    }
  }

  // MAINNET: Real Marinade staking
  try {
    // Dynamically import Marinade SDK (only on mainnet)
    const { Marinade, MarinadeConfig } = await import('@marinade.finance/marinade-ts-sdk');
    
    // Initialize Marinade SDK
    const config = new MarinadeConfig({
      connection,
      publicKey: fromPubkey,
    });
    const marinade = new Marinade(config);
    
    // Load Marinade state (required for SDK to work)
    await marinade.getMarinadeState();

    if (action === 'stake') {
      if (!amount || amount <= 0) {
        throw new Error('Amount is required for staking');
      }

      const stakeLamports = Math.floor(amount * LAMPORTS_PER_SOL);
      
      // Check balance
      const balance = await connection.getBalance(fromPubkey);
      const minBalance = stakeLamports + 0.01 * LAMPORTS_PER_SOL; // Amount + fees
      
      if (balance < minBalance) {
        throw new Error(`Insufficient SOL balance. Need ${amount + 0.01} SOL (including fees)`);
      }

      console.log('[Marinade][REAL] Creating deposit transaction on mainnet...', {
        amount: amount,
        lamports: stakeLamports,
        from: fromPubkey.toString()
      });

      // Use Marinade SDK to create deposit transaction (SOL → mSOL)
      const { transaction, associatedMSolTokenAccountAddress } = await marinade.deposit(stakeLamports);
      
      // Set fee payer and recent blockhash
      transaction.feePayer = fromPubkey;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      console.log('[Marinade][REAL] Requesting signature from Phantom...');
      console.log('mSOL token account will be:', associatedMSolTokenAccountAddress?.toBase58() || 'auto-created');
      
      // Sign and send via Phantom
      const txResult = await provider.signAndSendTransaction(transaction);
      const signature = typeof txResult === 'string' 
        ? txResult 
        : (txResult?.signature || txResult?.txid);
      
      if (!signature) {
        throw new Error('Failed to get transaction signature');
      }

      console.log('[Marinade][REAL] Transaction sent:', signature);
      console.log('View on explorer:', `https://explorer.solana.com/tx/${signature}?cluster=mainnet-beta`);
      console.log('You will receive mSOL in account:', associatedMSolTokenAccountAddress?.toBase58());

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('[Marinade][REAL] Transaction confirmed! SOL staked, mSOL received.');
      return signature;

    } else if (action === 'unstake' || action === 'liquidUnstake') {
      if (!amount || amount <= 0) {
        throw new Error('Amount is required for unstaking');
      }

      // For unstaking, amount is in mSOL (not SOL)
      const msolLamports = Math.floor(amount * LAMPORTS_PER_SOL);

      console.log('[Marinade][REAL] Creating unstake transaction on mainnet...', {
        action,
        msolAmount: amount,
        msolLamports,
        from: fromPubkey.toString()
      });

      let transaction;
      
      if (action === 'liquidUnstake') {
        // Instant/liquid unstake (mSOL → SOL immediately, slightly higher fee)
        const result = await marinade.liquidUnstake(msolLamports);
        transaction = result.transaction;
      } else {
        // Delayed unstake (mSOL → SOL after epoch, cheaper)
        const result = await marinade.unstake(msolLamports);
        transaction = result.transaction;
      }

      // Set fee payer and recent blockhash
      transaction.feePayer = fromPubkey;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      console.log('[Marinade][REAL] Requesting signature from Phantom...');
      
      // Sign and send via Phantom
      const txResult = await provider.signAndSendTransaction(transaction);
      const signature = typeof txResult === 'string' 
        ? txResult 
        : (txResult?.signature || txResult?.txid);
      
      if (!signature) {
        throw new Error('Failed to get transaction signature');
      }

      console.log('[Marinade][REAL] Transaction sent:', signature);
      console.log('View on explorer:', `https://explorer.solana.com/tx/${signature}?cluster=mainnet-beta`);

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      if (action === 'unstake') {
        console.log('[Marinade][REAL] Unstake requested! You will need to claim SOL after the epoch.');
      } else {
        console.log('[Marinade][REAL] Instant unstake completed! SOL received.');
      }

      return signature;
    } else {
      throw new Error(`Unsupported action: ${action}`);
    }
  } catch (error: any) {
    console.error('[Marinade] Staking error:', error);
    
    const errorMessage = error?.message || String(error);
    if (
      errorMessage.includes('User rejected') ||
      errorMessage.includes('User cancelled') ||
      errorMessage.includes('rejected') ||
      error?.code === 4001
    ) {
      throw new Error('Transaction was rejected by user');
    }
    
    // Provide more helpful error messages
    if (errorMessage.includes('insufficient funds') || errorMessage.includes('Insufficient')) {
      throw new Error(`Insufficient balance: ${errorMessage}`);
    }
    
    if (errorMessage.includes('devnet') || errorMessage.includes('not found')) {
      throw new Error('Marinade Finance is only available on Solana mainnet. Please switch to mainnet for real Marinade staking.');
    }
    
    throw new Error(`Marinade staking failed: ${errorMessage}`);
  }
}

/**
 * Get user's mSOL token account balance (mainnet only)
 */
export async function getMarinadeStakeAccounts(ownerPubkey: PublicKey) {
  const cluster = getCluster();
  
  // On devnet, return empty (no mSOL on devnet)
  if (cluster === 'devnet') {
    console.log('[Marinade][MOCK] Devnet - returning empty mSOL accounts');
    return {
      accounts: [],
      totalStaked: 0,
      msolMint: null,
      mode: 'mock' as const,
    };
  }

  try {
    const connection = getConnection(cluster);
    
    // Dynamically import Marinade SDK
    const { Marinade, MarinadeConfig } = await import('@marinade.finance/marinade-ts-sdk');
    
    // Initialize Marinade to get mSOL mint
    const config = new MarinadeConfig({
      connection,
      publicKey: ownerPubkey,
    });
    const marinade = new Marinade(config);
    
    // Load Marinade state first (required)
    const marinadeState = await marinade.getMarinadeState();
    
    // Get mSOL mint address
    const msolMint = marinadeState.mSolMintAddress;
    
    // Get user's mSOL token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPubkey, {
      mint: msolMint,
    });

    const accounts = tokenAccounts.value.map((account) => ({
      address: account.pubkey.toBase58(),
      lamports: account.account.data.parsed.info.tokenAmount.uiAmount || 0,
      state: 'active',
      mint: msolMint.toBase58(),
    }));

    const totalStaked = accounts.reduce((acc, account) => acc + (account.lamports || 0), 0);

    return {
      accounts,
      totalStaked,
      msolMint: msolMint.toBase58(),
      mode: 'real' as const,
    };
  } catch (error) {
    console.error('[Marinade] Error fetching stake accounts:', error);
    return {
      accounts: [],
      totalStaked: 0,
      msolMint: null,
      mode: 'real' as const,
    };
  }
}

/**
 * Claim delayed unstake (after epoch has passed) - mainnet only
 */
export async function claimMarinadeUnstake(
  fromPubkey: PublicKey,
  ticketPubkey: PublicKey
): Promise<string> {
  const cluster = getCluster();
  
  if (cluster === 'devnet') {
    throw new Error('Marinade claim is only available on mainnet');
  }

  const connection = getConnection(cluster);
  const provider: any = (window as any)?.solana;
  
  if (!provider?.isPhantom) {
    throw new Error('Phantom wallet not available');
  }

  try {
    const { Marinade, MarinadeConfig } = await import('@marinade.finance/marinade-ts-sdk');
    
    const config = new MarinadeConfig({
      connection,
      publicKey: fromPubkey,
    });
    const marinade = new Marinade(config);

    const { transaction } = await marinade.claim(new PublicKey(ticketPubkey));
    
    transaction.feePayer = fromPubkey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    const txResult = await provider.signAndSendTransaction(transaction);
    const signature = typeof txResult === 'string' 
      ? txResult 
      : (txResult?.signature || txResult?.txid);
    
    if (!signature) {
      throw new Error('Failed to get transaction signature');
    }

    await connection.confirmTransaction(signature, 'confirmed');
    return signature;
  } catch (error: any) {
    console.error('[Marinade] Claim unstake error:', error);
    throw new Error(`Failed to claim unstake: ${error?.message || String(error)}`);
  }
}
