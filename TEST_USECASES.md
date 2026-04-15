# DEX WorkflowVerse — Test Use Cases & Demo Guide

> **Prerequisites for ALL tests:**
> 1. Phantom Wallet installed and set to **Devnet** mode.
> 2. At least **3 SOL** in your Devnet wallet (use `solana airdrop 2 --url devnet` to get test SOL).
> 3. App running locally via `npm run dev`.

---

## 🟢 USE CASE 1: Create a Custom SPL Token
**Type:** REAL on-chain transaction  
**Module:** Create Token  

| Field | Value |
|-------|-------|
| Module Name | `Create FYPV Token` |
| Symbol | `FYPV` |
| Decimals | `6` |
| Initial Supply | `1000000` |

**What happens:** Phantom prompts you to sign. A real SPL token is minted on Devnet. You get 1,000,000 FYPV tokens in your wallet.  
**Verify:** Open Phantom → you'll see the new "FYPV" token with 1,000,000 balance.  
**Explorer:** Click the `txid` in Execution History → opens Solana Explorer showing the mint instruction.

---

## 🟢 USE CASE 2: Create a Raydium CPMM Liquidity Pool
**Type:** REAL on-chain transaction  
**Module:** Liquidity Pool  
**Prerequisite:** Complete Use Case 1 first (you need a custom token).

| Field | Value |
|-------|-------|
| Module Name | `Create FYPV/SOL Pool` |
| Protocol | `Raydium Pools (CPMM)` |
| Action | `Create New Pool` |
| Token A | `Custom Mint...` → paste your FYPV mint address |
| Token B | `SOL` |
| Initial Amount CUSTOM | `10000` (10k FYPV — keep some in your wallet for swaps later!) |
| Initial Amount SOL | `0.5` (half a SOL — enough to seed the pool) |
| Slippage | `1%` |

> **Why these amounts?** You minted 1,000,000 FYPV in Use Case 1. We seed only 10,000 (1%) into the pool so you still have 990,000 left for swapping and testing. 0.5 SOL is enough to create a functional AMM without draining your Devnet balance.

---

## 🟢 USE CASE 3: Real Swap via Raydium CPMM Pool
**Type:** REAL on-chain transaction  
**Module:** Swap Tokens  
**Prerequisite:** Complete Use Case 2 first (you need an active pool).

| Field | Value |
|-------|-------|
| Module Name | `Swap FYPV to SOL` |
| Protocol | `Raydium` |
| Source Token | `Custom Mint...` → paste your FYPV mint address |
| Target Token | `SOL` |
| Amount | `1000` (1,000 FYPV) |
| Slippage | `1` |

**What happens:** The engine detects your custom pool in localStorage, bypasses Jupiter entirely, and executes a real AMM swap against your Raydium CPMM pool on Devnet.  
**Verify:** Your SOL balance increases, your FYPV balance decreases by 1,000.  
**Explorer:** The `txid` shows a real Raydium `swap` instruction.

---

## 🟡 USE CASE 4: Mock Swap (SOL → USDC, No Custom Pool)
**Type:** MOCKED transaction (simulated math, real receipt)  
**Module:** Swap Tokens  

| Field | Value |
|-------|-------|
| Module Name | `Swap SOL to USDC` |
| Protocol | `Raydium` (or `Jupiter`) |
| Source Token | `SOL` |
| Target Token | `USDC` |
| Amount | `0.1` |
| Slippage | `1` |

**What happens:** No real SOL/USDC pool exists on Devnet. The engine calculates the swap math locally (0.1 SOL × ~$150 = ~15 USDC), signs a tiny self-transfer transaction on Devnet to generate a real `txid`, and updates the UI.  
**Verify:** Explorer shows a generic `SystemProgram.transfer` (1 lamport to self). The UI shows "Swap completed".  
**Why mocked:** Jupiter Aggregator does not operate on Devnet. No official SOL/USDC CPMM pool is deployed there.

---

## 🟢 USE CASE 5: Add Liquidity to Existing Pool
**Type:** REAL on-chain transaction  
**Module:** Liquidity Pool  
**Prerequisite:** Complete Use Case 2 first.

| Field | Value |
|-------|-------|
| Module Name | `Add Liquidity` |
| Protocol | `Raydium` |
| Action | `Add Liquidity` |
| Token A | `Custom Mint...` → paste FYPV mint |
| Token B | `SOL` |
| Amount A | `50000` |
| Amount B | `0.5` |
| Slippage | `1` |

**What happens:** Real tokens are deposited into your Raydium CPMM pool. You receive additional LP tokens.  
**Verify:** LP token balance increases. Pool reserves grow.

---

## 🟢 USE CASE 6: Remove Liquidity from Pool
**Type:** REAL on-chain transaction  
**Module:** Liquidity Pool  
**Prerequisite:** You must have LP tokens from Use Case 2 or 5.

| Field | Value |
|-------|-------|
| Module Name | `Remove Liquidity` |
| Protocol | `Raydium` |
| Action | `Remove Liquidity` |
| Token A | `Custom Mint...` → paste FYPV mint |
| Token B | `SOL` |
| LP Token Amount | `10` |
| Slippage | `1` |

**What happens:** LP tokens are burned. FYPV + SOL are returned to your wallet.  
**Verify:** FYPV and SOL balance increase. LP token balance decreases.

---

## 🟢 USE CASE 7: Stake SOL (Native Validator Staking)
**Type:** REAL on-chain transaction  
**Module:** Stake SOL  

| Field | Value |
|-------|-------|
| Module Name | `Stake 1 SOL` |
| Protocol | `Native` |
| Action | `Delegate` |
| Amount | `1` |
| Validator | Leave blank (auto-selects) or pick from list |

**What happens:** A real Stake Account is created on Devnet. 1 SOL is delegated to a validator. Uses the Helius SDK if API key is set, otherwise falls back to native `@solana/web3.js` StakeProgram instructions.  
**Verify:** Phantom shows a "Create Stake Account" + "Delegate" instruction. Explorer confirms the stake delegation.

---

## 🟢 USE CASE 8: Claim Rewards (CPMM Yield Harvest)
**Type:** REAL on-chain transaction (if you have LP positions)  
**Module:** Claim Rewards  
**Prerequisite:** Complete Use Case 2 or 5 first.

| Field | Value |
|-------|-------|
| Module Name | `Claim Rewards` |
| From Pool | `Liquidity Pool` |
| Token | `LP-TOKEN` |
| Auto-Reinvest | unchecked |

**What happens:** The engine finds your active LP positions, calculates accrued auto-compounding fees, and calls `raydium.cpmm.removeLiquidity` to burn ~1% of your LP tokens to physically extract the yield profit.  
**Verify:** FYPV + SOL balances increase slightly. LP token balance decreases slightly.

---

## 🟢 USE CASE 9: Transfer SOL to Another Wallet
**Type:** REAL on-chain transaction  
**Module:** Transfer  

| Field | Value |
|-------|-------|
| Module Name | `Send SOL` |
| Recipient | Any valid Devnet wallet address (e.g. a second Phantom wallet) |
| Amount | `0.05` |
| Token | `SOL` |
| Memo | `Test transfer` |

**What happens:** Phantom prompts for a real SOL transfer. Real lamports move between wallets.  
**Verify:** Recipient wallet balance increases by 0.05 SOL.

---

## 🟡 USE CASE 10: BTC Bridge (Simulated)
**Type:** SIMULATED (no real bridge protocol)  
**Module:** BTC Bridge  

| Field | Value |
|-------|-------|
| Module Name | `Bridge BTC` |
| Source Chain | `Bitcoin` |
| Target Chain | `sBTC Network` |
| Amount | `0.01` |

**What happens:** A simulated multi-step bridge confirmation flow runs (tracking fake BTC confirmations). At the end, a wrapped asset "mint" transaction is generated on Devnet.  
**Why simulated:** No real BTC↔Solana bridge exists on Devnet. This demonstrates the cross-chain workflow orchestration concept.

---

## 🟢 USE CASE 11: Auto-Earn Vault (1-Click DeFi Strategy)
**Type:** COMPOSITE (multiple real + mock transactions)  
**Module:** Auto-Earn Vault  

| Field | Value |
|-------|-------|
| Module Name | `Earn on SOL` |
| Asset | `SOL` |
| Amount | `2` |
| Risk Profile | `Balanced` |

**What happens (behind the scenes):**
1. **Step 1 — Swap:** 40% of 2 SOL (0.8 SOL) is swapped to USDC (mock if no pool, real if CPMM pool exists).
2. **Step 2 — Add Liquidity:** SOL + USDC are deposited into a liquidity pool to earn trading fees.
3. **Step 3 — Stake:** 20% (0.4 SOL) is staked to a Devnet validator for ~7% APY.

The user only sees ONE node and presses ONE button. Three blockchain transactions fire sequentially.  
**Verify:** Execution History shows 3 separate `txid` entries (swap, LP, stake).

---

## 🔗 Multi-Node Workflow Combos (FYP Presentation Demos)

### Demo A: "Token Launch Pipeline"
**Nodes:** Create Token → Liquidity Pool (Create) → Swap  
**Story:** Launch a new DeFi token, immediately create a trading market, and perform the first trade.

| Node | Key Values |
|------|-----------|
| Create Token | Symbol: `DEMO`, Decimals: `6`, Supply: `500000` |
| Liquidity Pool | Action: `Create Pool`, Token A: DEMO mint, Token B: SOL, Amount A: `50000`, Amount B: `0.5` |
| Swap | Source: DEMO mint, Target: SOL, Amount: `1000` |

### Demo B: "Passive Income Engine"
**Nodes:** Liquidity Pool (Add) → Claim Rewards → Stake  
**Story:** Deposit into a pool, harvest the fees, then lock profits into staking.

| Node | Key Values |
|------|-----------|
| Liquidity Pool | Action: `Add Liquidity`, Token A: FYPV mint, Token B: SOL, Amount A: `10000`, Amount B: `0.1` |
| Claim Rewards | From Pool: `Liquidity Pool`, Token: `LP-TOKEN` |
| Stake | Action: `Delegate`, Amount: `0.5` |

### Demo C: "Treasury Management"
**Nodes:** Swap → Transfer → Stake  
**Story:** Convert tokens, send a portion to a treasury wallet, stake the rest.

| Node | Key Values |
|------|-----------|
| Swap | Source: `SOL`, Target: `USDC`, Amount: `0.5` |
| Transfer | Recipient: (another wallet), Amount: `0.1`, Token: `SOL` |
| Stake | Action: `Delegate`, Amount: `0.3` |

---

## Legend

| Icon | Meaning |
|------|---------|
| 🟢 | **REAL** — Interacts with official Solana/Raydium smart contracts on Devnet |
| 🟡 | **MOCKED** — Math calculated locally, real blockchain receipt generated |
| 🔗 | **COMPOSITE** — Multiple transactions chained together |
