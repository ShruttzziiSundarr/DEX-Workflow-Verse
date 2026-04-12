/**
 * SPL Token utilities — foundational on-chain token operations.
 *
 * Provides ATA management, balance reads, and devnet test-token minting.
 * Used as a prerequisite by Raydium, Orca, and direct token operations.
 *
 * Uses dynamic imports for @solana/spl-token to avoid version-specific
 * TypeScript declaration mismatches across spl-token v0.3–v0.4.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

export const WSOL_MINT = 'So11111111111111111111111111111111111111112';

const SPL_TOKEN_PKG = '@solana/spl-token';

/** Load spl-token and return a typed handle. All functions are cast to `any`. */
async function spl() {
  const m = await import(/* @vite-ignore */ SPL_TOKEN_PKG);
  return m as any;
}

export interface TokenBalance {
  mint:       string;
  symbol?:    string;
  decimals:   number;
  /** Base-unit amount as a decimal string (avoids BigInt target issues) */
  rawAmount:  string;
  uiAmount:   number;
  ataAddress: string;
}

// ── ATA helpers ───────────────────────────────────────────────────────────────

/**
 * Derive the Associated Token Account address for a mint + owner.
 * Synchronous — no RPC call needed.
 */
export async function getATAAddress(
  mintAddress: string,
  ownerPubkey: PublicKey,
): Promise<PublicKey> {
  const lib = await spl();
  // spl-token v0.4 exposes getAssociatedTokenAddressSync
  // v0.3 exposes getAssociatedTokenAddress (async) — both are handled here
  if (typeof lib.getAssociatedTokenAddressSync === 'function') {
    return lib.getAssociatedTokenAddressSync(
      new PublicKey(mintAddress),
      ownerPubkey,
      false,
      lib.TOKEN_PROGRAM_ID,
      lib.ASSOCIATED_TOKEN_PROGRAM_ID,
    ) as PublicKey;
  }
  return lib.getAssociatedTokenAddress(
    new PublicKey(mintAddress),
    ownerPubkey,
    false,
    lib.TOKEN_PROGRAM_ID,
    lib.ASSOCIATED_TOKEN_PROGRAM_ID,
  ) as PublicKey;
}

/**
 * Get the ATA for a mint+owner, creating it on-chain if it doesn't exist.
 * The connected Phantom wallet pays for and signs the create instruction.
 *
 * @example
 * const { ataAddress, created } = await getOrCreateATA(
 *   connection, 'YOUR_MINT', walletPubkey, phantomProvider,
 * );
 */
export async function getOrCreateATA(
  connection: Connection,
  mintAddress: string,
  ownerPubkey: PublicKey,
  phantomProvider: any,
): Promise<{ ataAddress: PublicKey; created: boolean; signature?: string }> {
  const lib = await spl();
  const mint = new PublicKey(mintAddress);

  const ata: PublicKey = typeof lib.getAssociatedTokenAddressSync === 'function'
    ? lib.getAssociatedTokenAddressSync(mint, ownerPubkey, false, lib.TOKEN_PROGRAM_ID, lib.ASSOCIATED_TOKEN_PROGRAM_ID)
    : await lib.getAssociatedTokenAddress(mint, ownerPubkey, false, lib.TOKEN_PROGRAM_ID, lib.ASSOCIATED_TOKEN_PROGRAM_ID);

  const existing = await connection.getAccountInfo(ata);
  if (existing) return { ataAddress: ata, created: false };

  const ix = lib.createAssociatedTokenAccountInstruction(ownerPubkey, ata, ownerPubkey, mint);
  const tx = new Transaction().add(ix);
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = ownerPubkey;

  const txResult  = await phantomProvider.signAndSendTransaction(tx);
  const signature = typeof txResult === 'string' ? txResult : (txResult?.signature || txResult?.txid);
  if (!signature) throw new Error('Failed to get signature for ATA creation');
  await connection.confirmTransaction(signature, 'confirmed');

  return { ataAddress: ata, created: true, signature };
}

/**
 * Ensure ATAs exist for multiple mints in one call.
 * Batches all missing create instructions into a single transaction (saves fees).
 *
 * @returns map of mintAddress → ataAddress
 *
 * @example
 * await ensureATAs(connection, [inputMint, outputMint], walletPubkey, phantom);
 */
export async function ensureATAs(
  connection: Connection,
  mintAddresses: string[],
  ownerPubkey: PublicKey,
  phantomProvider: any,
): Promise<Record<string, PublicKey>> {
  const lib = await spl();
  const result: Record<string, PublicKey> = {};
  const missing: { ix: any; ata: PublicKey }[] = [];

  await Promise.all(mintAddresses.map(async (mintAddress) => {
    if (mintAddress === WSOL_MINT) {
      result[mintAddress] = ownerPubkey;
      return;
    }
    const mint = new PublicKey(mintAddress);
    const ata: PublicKey = typeof lib.getAssociatedTokenAddressSync === 'function'
      ? lib.getAssociatedTokenAddressSync(mint, ownerPubkey, false, lib.TOKEN_PROGRAM_ID, lib.ASSOCIATED_TOKEN_PROGRAM_ID)
      : await lib.getAssociatedTokenAddress(mint, ownerPubkey, false, lib.TOKEN_PROGRAM_ID, lib.ASSOCIATED_TOKEN_PROGRAM_ID);

    result[mintAddress] = ata;

    const info = await connection.getAccountInfo(ata);
    if (!info) {
      missing.push({
        ix: lib.createAssociatedTokenAccountInstruction(ownerPubkey, ata, ownerPubkey, mint),
        ata,
      });
    }
  }));

  if (missing.length === 0) return result;

  const tx = new Transaction();
  missing.forEach(({ ix }) => tx.add(ix));
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = ownerPubkey;

  const txResult  = await phantomProvider.signAndSendTransaction(tx);
  const signature = typeof txResult === 'string' ? txResult : (txResult?.signature || txResult?.txid);
  if (!signature) throw new Error('Failed to create ATAs');
  await connection.confirmTransaction(signature, 'confirmed');

  return result;
}

// ── Balance readers ───────────────────────────────────────────────────────────

/**
 * Get the SPL token balance for one mint. Returns 0 (not an error) if no ATA exists.
 */
export async function getTokenBalance(
  connection: Connection,
  ownerPubkey: PublicKey,
  mintAddress: string,
): Promise<{ rawAmount: string; uiAmount: number; decimals: number }> {
  if (mintAddress === WSOL_MINT) {
    const lamports = await connection.getBalance(ownerPubkey);
    return { rawAmount: lamports.toString(), uiAmount: lamports / LAMPORTS_PER_SOL, decimals: 9 };
  }

  const lib  = await spl();
  const mint = new PublicKey(mintAddress);
  const ata: PublicKey  = typeof lib.getAssociatedTokenAddressSync === 'function'
    ? lib.getAssociatedTokenAddressSync(mint, ownerPubkey)
    : await lib.getAssociatedTokenAddress(mint, ownerPubkey);

  try {
    const account  = await lib.getAccount(connection, ata);
    const mintInfo = await connection.getParsedAccountInfo(mint);
    const decimals: number = (mintInfo.value?.data as any)?.parsed?.info?.decimals ?? 9;
    const raw      = account.amount?.toString() ?? '0';
    const uiAmount = Number(raw) / Math.pow(10, decimals);
    return { rawAmount: raw, uiAmount, decimals };
  } catch {
    return { rawAmount: '0', uiAmount: 0, decimals: 9 };
  }
}

/**
 * Get ALL token balances for a wallet — native SOL plus every SPL token account.
 */
export async function getAllTokenBalances(
  connection: Connection,
  ownerPubkey: PublicKey,
): Promise<TokenBalance[]> {
  const lib      = await spl();
  const balances: TokenBalance[] = [];

  const solLamports = await connection.getBalance(ownerPubkey);
  balances.push({
    mint: WSOL_MINT, symbol: 'SOL', decimals: 9,
    rawAmount:  solLamports.toString(),
    uiAmount:   solLamports / LAMPORTS_PER_SOL,
    ataAddress: ownerPubkey.toBase58(),
  });

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPubkey, {
    programId: lib.TOKEN_PROGRAM_ID,
  });

  for (const { pubkey, account } of tokenAccounts.value) {
    const info = (account.data as any).parsed?.info;
    if (!info) continue;
    const { mint, tokenAmount } = info;
    balances.push({
      mint,
      decimals:   tokenAmount.decimals,
      rawAmount:  tokenAmount.amount,
      uiAmount:   tokenAmount.uiAmount ?? 0,
      ataAddress: pubkey.toBase58(),
    });
  }

  return balances;
}

/**
 * Throw if a wallet doesn't have enough of a token. Call before swap/LP ops.
 */
export async function assertSufficientBalance(
  connection: Connection,
  ownerPubkey: PublicKey,
  mintAddress: string,
  requiredUiAmount: number,
  label = 'token',
): Promise<void> {
  const { uiAmount } = await getTokenBalance(connection, ownerPubkey, mintAddress);
  if (uiAmount < requiredUiAmount) {
    throw new Error(
      `Insufficient ${label}. Required: ${requiredUiAmount}, Available: ${uiAmount.toFixed(6)}`,
    );
  }
}

// ── SPL Token creation ────────────────────────────────────────────────────────

export interface TokenCreationResult {
  mintAddress: string;
  ataAddress: string;
  signature: string;
  decimals: number;
  initialSupply: number;
}

/**
 * Create a brand-new SPL token mint on devnet.
 * Builds a single transaction that:
 *   1. Creates the mint account (funded by the owner)
 *   2. Initialises the mint (decimals + authorities)
 *   3. Creates the owner's Associated Token Account
 *   4. Mints `initialSupply` tokens to that ATA (if > 0)
 *
 * The mint keypair is pre-signed before Phantom is asked to sign,
 * so the user only sees one approval dialog.
 */
export async function createSPLToken(
  connection: Connection,
  ownerPubkey: PublicKey,
  decimals: number,
  initialSupply: number,
  phantomProvider: any,
): Promise<TokenCreationResult> {
  const lib = await spl();
  const { Keypair, SystemProgram } = await import('@solana/web3.js');

  const mintKeypair = Keypair.generate();
  const mintPubkey  = mintKeypair.publicKey;

  const mintRent = await connection.getMinimumBalanceForRentExemption(lib.MINT_SIZE);

  const ata: PublicKey = typeof lib.getAssociatedTokenAddressSync === 'function'
    ? lib.getAssociatedTokenAddressSync(mintPubkey, ownerPubkey, false, lib.TOKEN_PROGRAM_ID, lib.ASSOCIATED_TOKEN_PROGRAM_ID)
    : await lib.getAssociatedTokenAddress(mintPubkey, ownerPubkey);

  const tx = new Transaction();

  tx.add(
    SystemProgram.createAccount({
      fromPubkey:         ownerPubkey,
      newAccountPubkey:   mintPubkey,
      space:              lib.MINT_SIZE,
      lamports:           mintRent,
      programId:          lib.TOKEN_PROGRAM_ID,
    }),
    lib.createInitializeMintInstruction(mintPubkey, decimals, ownerPubkey, ownerPubkey),
    lib.createAssociatedTokenAccountInstruction(ownerPubkey, ata, ownerPubkey, mintPubkey),
  );

  if (initialSupply > 0) {
    const rawSupply = Math.floor(initialSupply * Math.pow(10, decimals));
    tx.add(lib.createMintToInstruction(mintPubkey, ata, ownerPubkey, rawSupply));
  }

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer        = ownerPubkey;

  // Pre-sign with the new mint keypair, then ask Phantom for the owner sig
  tx.partialSign(mintKeypair);
  const signedTx  = await phantomProvider.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, 'confirmed');

  return {
    mintAddress:   mintPubkey.toBase58(),
    ataAddress:    ata.toBase58(),
    signature,
    decimals,
    initialSupply,
  };
}

// ── Devnet test-token minting ─────────────────────────────────────────────────

/**
 * Mint test SPL tokens to a wallet on devnet.
 *
 * Prerequisites:
 *  - `mintAddress` was created with `spl-token create-token`
 *  - The connected Phantom wallet IS the mint authority
 *
 * @example
 * await mintTestTokens(connection, 'YOUR_MINT', walletPubkey, 1_000_000, 9, phantom);
 */
export async function mintTestTokens(
  connection: Connection,
  mintAddress: string,
  recipientPubkey: PublicKey,
  uiAmount: number,
  decimals: number,
  mintAuthorityProvider: any,
): Promise<{ signature: string; ataAddress: PublicKey }> {
  const lib = await spl();

  const { ataAddress } = await getOrCreateATA(
    connection, mintAddress, recipientPubkey, mintAuthorityProvider,
  );

  const rawAmount = Math.floor(uiAmount * Math.pow(10, decimals));

  const tx = new Transaction().add(
    lib.createMintToInstruction(
      new PublicKey(mintAddress),
      ataAddress,
      recipientPubkey,
      rawAmount,
    ),
  );

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = recipientPubkey;

  const txResult  = await mintAuthorityProvider.signAndSendTransaction(tx);
  const signature = typeof txResult === 'string' ? txResult : (txResult?.signature || txResult?.txid);
  if (!signature) throw new Error('Mint transaction signature missing');
  await connection.confirmTransaction(signature, 'confirmed');

  return { signature, ataAddress };
}
