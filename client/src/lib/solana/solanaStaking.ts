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
 * Handles delegate, deactivate, and withdraw operations
 */
export async function handleSolanaStake(params: StakeParams): Promise<string> {
  const { action, amount, validatorPubkey, stakeAccountPubkey, fromPubkey } = params;
  
  if (!fromPubkey) {
    throw new Error('Wallet not connected');
  }

  // Validate wallet has some balance for fees upfront
  const walletBalanceLamports = await solanaConnection.getBalance(fromPubkey);
  const minimumFeeBufferLamports = Math.floor(0.005 * LAMPORTS_PER_SOL); // ~0.005 SOL buffer for fees
  if (walletBalanceLamports < minimumFeeBufferLamports) {
    throw new Error('Insufficient SOL balance for transaction fees');
  }

  const tx = new Transaction();
  let instructions = [];

  if (action === 'delegate') {
    if (!amount) {
      throw new Error('Amount is required for delegate');
    }
    
    // Auto-select validator if not provided
    let votePubkey: PublicKey;
    if (validatorPubkey) {
      votePubkey = new PublicKey(validatorPubkey);
    } else {
      // Fetch validators and use the first one
      const voteAccounts = await solanaConnection.getVoteAccounts();
      if (voteAccounts.current.length === 0) {
        throw new Error('No validators available on this network');
      }
      votePubkey = new PublicKey(voteAccounts.current[0].votePubkey);
      console.log('Auto-selected validator:', votePubkey.toString());
    }
    const desiredStakeLamports = Math.floor(amount * LAMPORTS_PER_SOL);
    const stakeAccountSpace = 200; // Stake account size in bytes
    const rentExemptLamports = await solanaConnection.getMinimumBalanceForRentExemption(stakeAccountSpace);
    const requiredStakeAccountBalance = rentExemptLamports + desiredStakeLamports;

    // Use a seed to create a deterministic stake account address
    // Format: first 16 chars of validator pubkey (base58 encoded, so safe length)
    // This ensures the same validator + wallet = same stake account (can add more to same account)
    const seed = `stake_${votePubkey.toString().slice(0, 16)}`;
    const stakeAccount = await PublicKey.createWithSeed(
      fromPubkey,
      seed,
      STAKE_PROGRAM_ID
    );

    // Check if stake account exists
    const accountInfo = await solanaConnection.getAccountInfo(stakeAccount);
    
    if (!accountInfo) {
      // New stake account: create with seed and fund with rent exemption + desired stake
      instructions.push(
        SystemProgram.createAccountWithSeed({
          fromPubkey,
          basePubkey: fromPubkey,
          seed,
          newAccountPubkey: stakeAccount,
          lamports: requiredStakeAccountBalance,
          space: stakeAccountSpace,
          programId: STAKE_PROGRAM_ID,
        })
      );
      
      instructions.push(
        StakeProgram.initialize({
          stakePubkey: stakeAccount,
          authorized: { staker: fromPubkey, withdrawer: fromPubkey },
          lockup: { unixTimestamp: 0, epoch: 0, custodian: fromPubkey }, // No lockup - user is custodian
        })
      );
    } else {
      // Existing stake account: ensure it has at least rent + desired stake, top-up if needed
      const currentStakeAccountLamports = await solanaConnection.getBalance(stakeAccount);
      if (currentStakeAccountLamports < requiredStakeAccountBalance) {
        const topUpLamports = requiredStakeAccountBalance - currentStakeAccountLamports;
        instructions.push(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey: stakeAccount,
            lamports: topUpLamports,
          })
        );
      }
    }

    // Ensure wallet has enough balance to fund stake + fees before proceeding
    const walletBalance = await solanaConnection.getBalance(fromPubkey);
    const totalNeeded = requiredStakeAccountBalance + minimumFeeBufferLamports;
    if (walletBalance < totalNeeded) {
      const neededSol = (totalNeeded - walletBalance) / LAMPORTS_PER_SOL;
      throw new Error(`Insufficient SOL balance. Need ~${neededSol.toFixed(3)} more SOL to stake including fees.`);
    }

    // Delegate to validator
    instructions.push(
      StakeProgram.delegate({
        stakePubkey: stakeAccount,
        authorizedPubkey: fromPubkey,
        votePubkey,
      })
    );

  } else if (action === 'deactivate') {
    if (!stakeAccountPubkey) {
      throw new Error('Stake account required for deactivate');
    }
    
    const stakePubkey = new PublicKey(stakeAccountPubkey);
    instructions.push(
      StakeProgram.deactivate({
        stakePubkey,
        authorizedPubkey: fromPubkey,
      })
    );

  } else if (action === 'withdraw') {
    if (!stakeAccountPubkey) {
      throw new Error('Stake account required for withdraw');
    }
    
    const stakePubkey = new PublicKey(stakeAccountPubkey);
    const balance = await solanaConnection.getBalance(stakePubkey);
    
    if (balance === 0) {
      throw new Error('No funds to withdraw from stake account');
    }
    
    instructions.push(
      StakeProgram.withdraw({
        stakePubkey,
        authorizedPubkey: fromPubkey,
        toPubkey: fromPubkey,
        lamports: balance,
      })
    );
  }

  // Build transaction
  tx.add(...instructions);

  // Get recent blockhash and set fee payer
  const { blockhash } = await solanaConnection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = fromPubkey;

  // Get Phantom provider
  const provider: any = (window as any)?.solana;
  if (!provider?.isPhantom) {
    throw new Error('Phantom wallet not available');
  }

  // Sign and send transaction
  try {
    // Check connection before proceeding
    const isConnected = await provider.connect({ onlyIfTrusted: true }).catch(() => false);
    if (!isConnected) {
      throw new Error('Wallet not connected. Please connect your wallet and try again.');
    }

    // Check if we have enough SOL for the transaction
    const balance = await solanaConnection.getBalance(fromPubkey);
    const minBalance = await solanaConnection.getMinimumBalanceForRentExemption(0) + (amount ? Number(amount) : 0);
    
    if (balance < minBalance) {
      throw new Error('Insufficient SOL balance for this transaction');
    }

    console.log('Preparing transaction with instructions:', instructions.length);
    console.log('Transaction details:', {
      action,
      amount,
      validatorPubkey,
      fromPubkey: fromPubkey.toString(),
      instructions: instructions.map((ix, idx) => `${idx}: ${ix.programId.toString()}`)
    });
    
    // Sign and send transaction (no retries for user interaction - only one attempt)
    let signature: string;
    
    try {
      console.log('Requesting signature from Phantom wallet...');
      
      // Use signAndSendTransaction which handles both signing and sending
      const txResult = await provider.signAndSendTransaction(tx);
      
      // Handle different response formats
      if (typeof txResult === 'string') {
        signature = txResult;
      } else if (txResult?.signature) {
        signature = txResult.signature;
      } else if (txResult?.txid) {
        signature = txResult.txid;
      } else {
        throw new Error('Invalid transaction response format');
      }
      
      console.log('Transaction signature received:', signature);
      console.log('View transaction:', `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      
    } catch (e: any) {
      // Check for user rejection
      const errorMessage = e?.message || String(e);
      const errorCode = e?.code;
      
      console.error('Transaction signing error:', {
        message: errorMessage,
        code: errorCode,
        error: e
      });
      
      if (
        errorMessage.includes('User rejected') || 
        errorMessage.includes('User cancelled') ||
        errorMessage.includes('user rejected') ||
        errorMessage.includes('rejected') ||
        errorCode === 4001 ||
        errorCode === '4001'
      ) {
        throw new Error('Transaction was rejected by user');
      }
      
      // Re-throw other errors
      throw new Error(`Transaction failed: ${errorMessage || 'Unknown error'}`);
    }
    
    if (!signature) {
      throw new Error('Failed to get transaction signature');
    }
    
    // Wait for confirmation with timeout
    console.log('Waiting for transaction confirmation...');
    try {
      const confirmation = await Promise.race([
        solanaConnection.confirmTransaction(signature, 'confirmed'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Confirmation timeout')), 30000)
        )
      ]) as any;
      
      if (confirmation?.value?.err) {
        const errorDetails = JSON.stringify(confirmation.value.err);
        console.error('Transaction confirmation error:', errorDetails);
        throw new Error(`Transaction failed on-chain: ${errorDetails}`);
      }
      
      console.log('Transaction confirmed successfully!');
      console.log('Final balance check...');
      
      // Verify the transaction actually happened by checking balance change
      if (action === 'delegate' && amount) {
        const newBalance = await solanaConnection.getBalance(fromPubkey);
        console.log('Wallet balance after transaction:', newBalance / LAMPORTS_PER_SOL, 'SOL');
      }
      
    } catch (confirmationError: any) {
      // If confirmation fails, check if transaction exists on-chain
      const txStatus = await solanaConnection.getSignatureStatus(signature);
      if (txStatus?.value?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(txStatus.value.err)}`);
      }
      // If we can't confirm but transaction exists, it might still be processing
      console.warn('Could not confirm transaction, but signature exists:', signature);
    }
    
    return signature;
  } catch (error: any) {
    console.error('Transaction failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      logs: error.logs
    });
    
    if (error.message?.includes('User rejected')) {
      throw new Error('Transaction was rejected by user');
    } else if (error.message?.includes('Insufficient funds')) {
      throw new Error('Insufficient SOL balance for transaction');
    } else if (error.message?.includes('Unexpected error')) {
      throw new Error('Transaction failed: Please check your wallet connection and try again');
    } else {
      throw new Error(`Transaction failed: ${error.message || 'Unknown error'}`);
    }
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
