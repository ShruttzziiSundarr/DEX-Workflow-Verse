# Solana Staking Implementation

This document outlines the Solana staking functionality implemented in the DEX Workflow Verse project.

## Overview

The staking implementation supports three core Solana staking operations:
- **Delegate**: Stake SOL to a validator
- **Deactivate**: Stop earning rewards (unstake)
- **Withdraw**: Withdraw SOL from a deactivated stake account

## Key Components

### 1. Solana Staking Library (`client/src/lib/solana/solanaStaking.ts`)

**Core Functions:**
- `handleSolanaStake()` - Unified function for all staking operations
- `getValidators()` - Fetch available validators from devnet
- `getUserStakeAccounts()` - Get user's existing stake accounts
- `getStakeActivation()` - Check stake account status
- `createStakeAccountAddress()` - Generate deterministic stake account addresses

**Features:**
- Supports all three staking operations in one function
- Automatic stake account creation for new delegations
- Deterministic stake account address generation
- Full error handling and validation

### 2. Validator Selector Component (`client/src/components/ValidatorSelector.tsx`)

**Features:**
- Fetches and displays available validators
- Shows validator commission rates and stake amounts
- Displays validator status and details
- User-friendly dropdown interface

### 3. Updated Configuration Panel (`client/src/components/ConfigPanel.tsx`)

**New Fields:**
- Action selector (Delegate/Deactivate/Withdraw)
- Amount input for delegation
- Validator selection (using ValidatorSelector)
- Stake account input for deactivate/withdraw operations

### 4. Workflow Integration (`client/src/components/WorkflowCanvas.tsx`)

**Execution Flow:**
- Detects stake nodes in workflows
- Validates configuration parameters
- Executes staking transactions via Phantom wallet
- Provides real-time feedback and transaction signatures

### 5. Backend API (`server/routes.ts`)

**Endpoint:** `POST /api/stake`

**Request Format:**
```json
{
  "action": "delegate|deactivate|withdraw",
  "amount": 1.0,
  "validatorPubkey": "validator_public_key",
  "stakeAccountPubkey": "stake_account_public_key",
  "fromPubkey": "user_wallet_public_key"
}
```

**Response Format:**
```json
{
  "success": true,
  "signature": "transaction_signature",
  "message": "Transaction confirmed message",
  "action": "delegate",
  "amount": 1.0,
  "validatorPubkey": "validator_public_key"
}
```

## Usage

### 1. Delegate (Stake) SOL
```typescript
const signature = await handleSolanaStake({
  action: 'delegate',
  amount: 1.0,
  validatorPubkey: 'validator_public_key',
  fromPubkey: userPublicKey
});
```

### 2. Deactivate (Unstake)
```typescript
const signature = await handleSolanaStake({
  action: 'deactivate',
  stakeAccountPubkey: 'stake_account_public_key',
  fromPubkey: userPublicKey
});
```

### 3. Withdraw SOL
```typescript
const signature = await handleSolanaStake({
  action: 'withdraw',
  stakeAccountPubkey: 'stake_account_public_key',
  fromPubkey: userPublicKey
});
```

## Dependencies

- `@solana/web3.js` (v1.98.4) - Core Solana SDK
- Phantom wallet integration for transaction signing
- Solana devnet RPC endpoint

## Network Configuration

- **Network**: Solana Devnet
- **RPC Endpoint**: `https://api.devnet.solana.com`
- **Stake Program**: `Stake11111111111111111111111111111111111111`

## Security Considerations

- All transactions are signed by the user's Phantom wallet
- No private keys are stored or transmitted
- Stake accounts are user-controlled
- Full validation of all input parameters

## Testing

1. Connect Phantom wallet to Solana Devnet
2. Get devnet SOL from faucet
3. Create a workflow with stake nodes
4. Configure validator and amount
5. Execute the workflow

## Future Enhancements

- Support for liquid staking protocols (Jito, Marinade)
- Stake pool integration
- Advanced validator analytics
- Automated rebalancing strategies
