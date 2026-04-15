import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  StakeProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl
} from "@solana/web3.js";

// Solana Stake Program ID
const STAKE_PROGRAM_ID = new PublicKey("Stake11111111111111111111111111111111111111");

export const solanaConnection = new Connection(clusterApiUrl("devnet"), "confirmed");

export type StakeAction = 'delegate' | 'deactivate' | 'withdraw';

export interface StakeParams {
  action: StakeAction;
  amount?: number; // SOL, for delegate
  validatorPubkey?: string; // For delegate
  stakeAccountPubkey?: string; // For deactivate/withdraw (existing account)
  fromPubkey: PublicKey; // Wallet pubkey
}

export interface ValidatorInfo {
  votePubkey: string;
  nodePubkey: string;
  activatedStake: number;
  commission: number;
  lastVote: number;
  rootSlot: number;
  epochCredits: Array<[number, number, number]>;
  epochVoteAccount: boolean;
}

/**
 * Fetch available validators from devnet
 */
export async function getValidators(): Promise<ValidatorInfo[]> {
  try {
    const voteAccounts = await solanaConnection.getVoteAccounts();
    const validators = [
      ...voteAccounts.current.map(account => ({
        votePubkey: account.votePubkey.toString(),
        nodePubkey: account.nodePubkey.toString(),
        activatedStake: account.activatedStake,
        commission: account.commission,
        lastVote: account.lastVote,
        rootSlot: 0, // rootSlot not available in VoteAccountInfo
        epochCredits: account.epochCredits,
        epochVoteAccount: account.epochVoteAccount
      })),
      ...voteAccounts.delinquent.map(account => ({
        votePubkey: account.votePubkey.toString(),
        nodePubkey: account.nodePubkey.toString(),
        activatedStake: account.activatedStake,
        commission: account.commission,
        lastVote: account.lastVote,
        rootSlot: 0, // rootSlot not available in VoteAccountInfo
        epochCredits: account.epochCredits,
        epochVoteAccount: account.epochVoteAccount
      }))
    ];
    
    // If no validators found, return a known devnet validator
    if (validators.length === 0) {
      console.warn('No validators found, using fallback validator');
      return [{
        votePubkey: '7XSY3MrYnK8vq693Rju17bbPkCN3Z7KvvfvJx4kdrsLw',
        nodePubkey: '7XSY3MrYnK8vq693Rju17bbPkCN3Z7KvvfvJx4kdrsLw',
        activatedStake: 1000000000,
        commission: 0,
        lastVote: 0,
        rootSlot: 0,
        epochCredits: [],
        epochVoteAccount: true
      }];
    }
    
    return validators;
  } catch (error: any) {
    console.error('Transaction error:', error);
    
    // Enhance error messages for better user feedback
    if (error?.message?.includes('User rejected')) {
      throw new Error('Transaction was rejected by user');
    } else if (error?.message?.includes('insufficient funds')) {
      throw new Error('Insufficient funds to complete this transaction');
    } else if (error?.message?.includes('Invalid blockhash')) {
      throw new Error('Network congestion detected. Please try again');
    } else if (error?.message?.includes('Blockhash not found')) {
      throw new Error('Transaction took too long to confirm. Please try again');
    }
    
    // Include error code if available for debugging
    const errorCode = error?.code || 'unknown';
    throw new Error(`Transaction failed (${errorCode}): ${error.message}`);
  }
}

/**
 * Get user's stake accounts
 */
export async function getUserStakeAccounts(userPubkey: PublicKey): Promise<PublicKey[]> {
  try {
    const stakeAccounts = await solanaConnection.getParsedProgramAccounts(
      STAKE_PROGRAM_ID,
      {
        filters: [
          {
            memcmp: {
              offset: 44, // Owner field offset in stake account
              bytes: userPubkey.toBase58()
            }
          }
        ]
      }
    );
    
    return stakeAccounts.map(account => new PublicKey(account.pubkey));
  } catch (error) {
    console.error('Error fetching stake accounts:', error);
    return [];
  }
}

/**
 * Get stake account activation status
 */
export async function getStakeActivation(stakePubkey: PublicKey) {
  try {
    return await solanaConnection.getStakeActivation(stakePubkey);
  } catch (error) {
    console.error('Error getting stake activation:', error);
    return null;
  }
}

/**
 * Create a deterministic stake account address
 */
export async function createStakeAccountAddress(
  fromPubkey: PublicKey, 
  validatorPubkey: string, 
  seed?: string
): Promise<PublicKey> {
  const seedString = seed || validatorPubkey;
  return PublicKey.createWithSeed(
    fromPubkey, 
    seedString, 
    STAKE_PROGRAM_ID
  );
}

/**
 * Unified Solana staking function
 * Identifies if Helius API key is available, utilizing Helius SDK for automated staking.
 * Falls back to Native Staking (manual serialization) if no key is provided.
 */
export async function handleSolanaStake(params: StakeParams): Promise<string> {
  const { action, amount, validatorPubkey, stakeAccountPubkey, fromPubkey } = params;
  
  if (!fromPubkey) {
    throw new Error('Wallet not connected');
  }

  // Get Phantom provider
  const provider: any = (window as any)?.solana;
  if (!provider?.isPhantom) {
    throw new Error('Phantom wallet not available');
  }

  // Validate wallet connection before proceeding
  const isConnected = await provider.connect({ onlyIfTrusted: true }).catch(() => false);
  if (!isConnected) {
    throw new Error('Wallet not connected. Please connect your wallet and try again.');
  }

  // Check for Helius environment variable
  const heliusApiKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_HELIUS_API_KEY) || '';

  if (heliusApiKey && heliusApiKey !== 'YOUR_API_KEY') {
    // ═══════════════════════════════════════════════════════════════════════════════
    // HELIUS SDK STAKING (Based on provided documentation)
    // ═══════════════════════════════════════════════════════════════════════════════
    try {
      console.log('[Helius] Using Helius SDK for automated staking');
      
      // Dynamically import to prevent breaking if not installed yet
      const { Helius } = await import('helius-sdk');
      const bs58 = (await import('bs58')).default;
      
      const helius = new Helius(heliusApiKey, 'devnet');

      if (action === 'delegate') {
        if (!amount) throw new Error('Amount is required for delegate');

        console.log(`[Helius] Creating staking tx for ${amount} SOL...`);
        const { serializedTx, stakeAccountPubkey: newStakeAccount } = 
          await helius.rpc.createStakeTransaction(fromPubkey.toBase58(), amount);

        const tx = Transaction.from(bs58.decode(serializedTx));
        tx.feePayer = fromPubkey;
        const { blockhash } = await solanaConnection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        console.log('[Helius] Requesting Phantom signature...');
        const txResult = await provider.signAndSendTransaction(tx);
        const signature = typeof txResult === 'string' ? txResult : (txResult?.signature || txResult?.txid);

        await solanaConnection.confirmTransaction(signature, 'confirmed');
        console.log(`[Helius] Successfully staked! Account: ${newStakeAccount}`);
        return signature;

      } else if (action === 'deactivate') {
        if (!stakeAccountPubkey) throw new Error('Stake account required for deactivate');
        
        console.log(`[Helius] Unstaking account ${stakeAccountPubkey}...`);
        const serializedTx = await helius.rpc.createUnstakeTransaction(
          fromPubkey.toBase58(),
          stakeAccountPubkey
        );

        const tx = Transaction.from(bs58.decode(serializedTx));
        tx.feePayer = fromPubkey;
        const { blockhash } = await solanaConnection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        const txResult = await provider.signAndSendTransaction(tx);
        const signature = typeof txResult === 'string' ? txResult : (txResult?.signature || txResult?.txid);
        
        await solanaConnection.confirmTransaction(signature, 'confirmed');
        return signature;

      } else if (action === 'withdraw') {
        if (!stakeAccountPubkey) throw new Error('Stake account required for withdraw');

        const withdrawableAmount = await helius.rpc.getWithdrawableAmount(stakeAccountPubkey, true);
        if (withdrawableAmount <= 0) throw new Error('No funds available to withdraw yet (still deactivating)');

        console.log(`[Helius] Withdrawing ${withdrawableAmount / LAMPORTS_PER_SOL} SOL...`);
        const serializedTx = await helius.rpc.createWithdrawTransaction(
          fromPubkey.toBase58(),
          stakeAccountPubkey,
          fromPubkey.toBase58(),
          withdrawableAmount
        );

        const tx = Transaction.from(bs58.decode(serializedTx));
        tx.feePayer = fromPubkey;
        const { blockhash } = await solanaConnection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        const txResult = await provider.signAndSendTransaction(tx);
        const signature = typeof txResult === 'string' ? txResult : (txResult?.signature || txResult?.txid);
        
        await solanaConnection.confirmTransaction(signature, 'confirmed');
        return signature;
      }
    } catch (heliusError: any) {
      console.warn('[Helius] Failed, falling back to Native Staking:', heliusError);
      // Fall through to Native Staking if Helius fails
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // NATIVE SOLANA STAKING (Fallback / Local dev without API Key)
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('[Native] Using Native Solana Staking');
  
  const walletBalanceLamports = await solanaConnection.getBalance(fromPubkey);
  const minimumFeeBufferLamports = Math.floor(0.005 * LAMPORTS_PER_SOL);
  if (walletBalanceLamports < minimumFeeBufferLamports) {
    throw new Error('Insufficient SOL balance for transaction fees');
  }

  const tx = new Transaction();
  let instructions = [];

  if (action === 'delegate') {
    if (!amount) throw new Error('Amount is required for delegate');
    
    let votePubkey: PublicKey;
    if (validatorPubkey) {
      votePubkey = new PublicKey(validatorPubkey);
    } else {
      const voteAccounts = await solanaConnection.getVoteAccounts();
      if (voteAccounts.current.length === 0) throw new Error('No validators available');
      votePubkey = new PublicKey(voteAccounts.current[0].votePubkey);
    }
    
    const desiredStakeLamports = Math.floor(amount * LAMPORTS_PER_SOL);
    const stakeAccountSpace = 200;
    const rentExemptLamports = await solanaConnection.getMinimumBalanceForRentExemption(stakeAccountSpace);
    const requiredStakeAccountBalance = rentExemptLamports + desiredStakeLamports;

    const seed = `stake_${votePubkey.toString().slice(0, 16)}`;
    const stakeAccount = await PublicKey.createWithSeed(fromPubkey, seed, STAKE_PROGRAM_ID);

    const accountInfo = await solanaConnection.getAccountInfo(stakeAccount);
    if (!accountInfo) {
      instructions.push(
        SystemProgram.createAccountWithSeed({
          fromPubkey,
          basePubkey: fromPubkey,
          seed,
          newAccountPubkey: stakeAccount,
          lamports: requiredStakeAccountBalance,
          space: stakeAccountSpace,
          programId: STAKE_PROGRAM_ID,
        }),
        StakeProgram.initialize({
          stakePubkey: stakeAccount,
          authorized: { staker: fromPubkey, withdrawer: fromPubkey },
          lockup: { unixTimestamp: 0, epoch: 0, custodian: fromPubkey },
        })
      );
    } else {
      const currentStakeAccountLamports = await solanaConnection.getBalance(stakeAccount);
      if (currentStakeAccountLamports < requiredStakeAccountBalance) {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey: stakeAccount,
            lamports: requiredStakeAccountBalance - currentStakeAccountLamports,
          })
        );
      }
    }

    instructions.push(
      StakeProgram.delegate({
        stakePubkey: stakeAccount,
        authorizedPubkey: fromPubkey,
        votePubkey,
      })
    );

  } else if (action === 'deactivate') {
    if (!stakeAccountPubkey) throw new Error('Stake account required for deactivate');
    instructions.push(
      StakeProgram.deactivate({
        stakePubkey: new PublicKey(stakeAccountPubkey),
        authorizedPubkey: fromPubkey,
      })
    );

  } else if (action === 'withdraw') {
    if (!stakeAccountPubkey) throw new Error('Stake account required for withdraw');
    const stakePubkey = new PublicKey(stakeAccountPubkey);
    const balance = await solanaConnection.getBalance(stakePubkey);
    if (balance === 0) throw new Error('No funds to withdraw from stake account');
    instructions.push(
      StakeProgram.withdraw({
        stakePubkey,
        authorizedPubkey: fromPubkey,
        toPubkey: fromPubkey,
        lamports: balance,
      })
    );
  }

  tx.add(...instructions);
  const { blockhash } = await solanaConnection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = fromPubkey;

  try {
    console.log('[Native] Requesting signature from Phantom wallet...');
    const txResult = await provider.signAndSendTransaction(tx);
    const signature = typeof txResult === 'string' ? txResult : (txResult?.signature || txResult?.txid);
    
    if (!signature) throw new Error('Failed to get transaction signature');
    
    await solanaConnection.confirmTransaction(signature, 'confirmed');
    return signature;
  } catch (error: any) {
    if (error?.message?.includes('rejected')) throw new Error('Transaction was rejected by user');
    throw new Error(`Transaction failed: ${error.message}`);
  }
}

/**
 * Get current epoch information
 */
export async function getEpochInfo() {
  try {
    return await solanaConnection.getEpochInfo();
  } catch (error) {
    console.error('Error getting epoch info:', error);
    return null;
  }
}

/**
 * Get stake account details
 */
export async function getStakeAccountInfo(stakePubkey: PublicKey) {
  try {
    const accountInfo = await solanaConnection.getAccountInfo(stakePubkey);
    if (!accountInfo) return null;
    
    const parsed = await solanaConnection.getParsedAccountInfo(stakePubkey);
    return parsed.value?.data;
  } catch (error) {
    console.error('Error getting stake account info:', error);
    return null;
  }
}
