import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Clock,
  CheckCircle,
  AlertTriangle,
  Zap,
  ArrowRightLeft,
  Droplets,
  TrendingUp,
  Gift,
  Globe,
  Send,
  Layers,
  MinusCircle,
  Info,
  Lightbulb,
  ChevronRight,
  PlusCircle,
  Landmark,
  Code,
  Globe2,
  Mail,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   Operation data — on-chain + simulated modules
   ═══════════════════════════════════════════════════════════════════════════ */

interface OperationDoc {
  type: string;
  title: string;
  shortTitle: string;
  icon: React.ReactNode;
  category: string;
  onChain: boolean;
  platform: string;
  platformUrl: string;
  whenToUse: string;
  prerequisites: string[];
  manualSteps: string[];
  workflowVerseSteps: string[];
  example: { scenario: string; parameters: Record<string, string> };
  tips: string[];
  timeTraditional: string;
  timeWorkflowVerse: string;
  description: string;
}

const OPERATIONS: OperationDoc[] = [
  {
    type: 'autoEarn',
    title: 'Auto-Earn Vault (1-Click)',
    shortTitle: 'Auto-Earn Vault',
    icon: <Layers className="h-4 w-4" />,
    category: 'Automation',
    onChain: true,
    platform: 'DEX WorkflowVerse',
    platformUrl: 'Builder → Auto-Earn Vault',
    whenToUse:
      'Use this when you want an intent-based strategy that bundles rebalancing, liquidity deployment, and staking into one execution path with verifiable receipts.',
    prerequisites: [
      'Phantom wallet connected to Solana Devnet',
      'Sufficient SOL balance for strategy amount and fees',
      'Risk profile selected (conservative / balanced / aggressive)',
    ],
    manualSteps: [
      'Swap part of SOL into a stable asset manually',
      'Open liquidity interface and add the pair into an LP pool',
      'Stake remaining SOL in a validator interface',
      'Track each transaction separately across multiple pages',
    ],
    workflowVerseSteps: [
      'Drag "Auto-Earn Vault" onto canvas',
      'Set asset, amount, and risk profile',
      'Execute once and approve sequential wallet prompts',
      'Review grouped execution history with per-step tx entries',
    ],
    example: {
      scenario: 'Deploy a balanced strategy using 2 SOL through a single Auto-Earn node.',
      parameters: { Asset: 'SOL', Amount: '2.0', 'Risk Profile': 'Balanced', Sequence: 'Swap → Add Liquidity → Stake' },
    },
    tips: [
      'On Devnet, swap runs real-first and falls back when route liquidity is unavailable',
      'Claim Rewards can be attached downstream to harvest LP fee yield',
    ],
    timeTraditional: '20–35 min',
    timeWorkflowVerse: '~6 min',
    description: 'One-click strategy orchestration across swap, LP provisioning, and staking.',
  },
  /* ── On-chain: Trading ──────────────────────────────────────────────── */
  {
    type: 'createPool',
    title: 'Create Pool (Raydium)',
    shortTitle: 'Create Pool',
    icon: <PlusCircle className="h-4 w-4" />,
    category: 'Trading',
    onChain: true,
    platform: 'raydium.io',
    platformUrl: 'Concentrated → Create Pool',
    whenToUse:
      'When you want to create a new concentrated liquidity pool for a custom token pair that doesn\'t yet have a market on Raydium. Common for newly launched tokens or devnet testing.',
    prerequisites: [
      'Wallet connected with SOL for fees',
      'Both tokens minted and in your wallet',
      'Decided on initial price and fee tier',
      'SOL for rent-exempt account creation (~0.01 SOL)',
    ],
    manualSteps: [
      'Connect wallet → select token pair',
      'Set initial price → set fee tier',
      'Deposit both tokens',
      'Approve 2 transactions → confirm creation',
    ],
    workflowVerseSteps: [
      'Drag "Create Pool" module onto canvas',
      'Select token pair and initial price',
      'Configure fee tier and deposit amounts',
      'Execute — pool creation handled in workflow',
    ],
    example: {
      scenario: 'Create a SOL/MYTOKEN pool on Raydium Devnet with 0.25% fee tier.',
      parameters: { 'Token A': 'SOL', 'Token B': 'MYTOKEN', 'Fee Tier': '0.25%', 'Initial Price': '100 MYTOKEN per SOL' },
    },
    tips: [
      'Choose fee tier based on expected volatility: 0.01% for stables, 0.25% for majors, 1% for volatile',
      'Initial price sets the market — double-check this before confirming',
    ],
    timeTraditional: '15–25 min',
    timeWorkflowVerse: '~10 min',
    description: 'Create a new concentrated liquidity pool on Raydium for any SPL token pair.',
  },
  {
    type: 'swap',
    title: 'Swap (Raydium)',
    shortTitle: 'Raydium Swap',
    icon: <ArrowRightLeft className="h-4 w-4" />,
    category: 'Trading',
    onChain: true,
    platform: 'raydium.io/swap',
    platformUrl: 'raydium.io/swap',
    whenToUse:
      'When you need to exchange tokens directly on Raydium. Best for pairs with deep Raydium liquidity or when you want to interact directly with Raydium pools.',
    prerequisites: [
      'Phantom/Solflare wallet connected',
      'SOL for transaction fees (~0.0001 SOL)',
      'Sufficient source token balance',
    ],
    manualSteps: [
      'Connect wallet → pick tokens',
      'Enter amount → adjust slippage',
      'Approve tx → verify on explorer',
    ],
    workflowVerseSteps: [
      'Drag "Swap" module onto canvas',
      'Select token pair and amount',
      'Set slippage and execute',
    ],
    example: {
      scenario: 'Swap 0.5 SOL → USDC on Raydium Devnet.',
      parameters: { 'From': 'SOL', 'To': 'USDC', 'Amount': '0.5 SOL', 'Slippage': '0.5%' },
    },
    tips: [
      'Raydium CLMM pools offer tighter spreads than legacy AMM pools',
      'Check price impact before large swaps',
    ],
    timeTraditional: '5–8 min',
    timeWorkflowVerse: '~3 min',
    description: 'Exchange tokens directly via Raydium\'s AMM and concentrated liquidity pools.',
  },
  {
    type: 'addLiquidity',
    title: 'Add Liquidity (Raydium)',
    shortTitle: 'Add Liquidity',
    icon: <Droplets className="h-4 w-4" />,
    category: 'Liquidity',
    onChain: true,
    platform: 'raydium.io/liquidity',
    platformUrl: 'raydium.io/liquidity',
    whenToUse:
      'When you want to earn trading fees by providing liquidity. Deposit both tokens in a pair and receive LP tokens representing your share.',
    prerequisites: [
      'Both tokens in wallet (sufficient balance)',
      'SOL for fees (~0.005 SOL)',
      'Pool must exist on Raydium',
      'Understanding of impermanent loss',
    ],
    manualSteps: [
      'Connect wallet → find pool',
      'Enter amounts for both tokens',
      'Approve token A → approve token B',
      'Confirm deposit → verify LP tokens',
    ],
    workflowVerseSteps: [
      'Drag "Add Liquidity" onto canvas',
      'Select Token A & B, enter amounts',
      'Set slippage → connect to workflow',
      'Execute — both approvals handled automatically',
    ],
    example: {
      scenario: 'Add liquidity: 0.5 SOL + 50 USDC into Raydium pool.',
      parameters: { 'Token A': '0.5 SOL', 'Token B': '50 USDC', 'Slippage': '50 bps' },
    },
    tips: [
      '⚠️ Impermanent loss risk with volatile pairs',
      'LP tokens can be staked in farms for bonus yield',
      'Start with stablecoin pairs (USDC/USDT) for lower risk',
    ],
    timeTraditional: '10–15 min',
    timeWorkflowVerse: '~5 min',
    description: 'Deposit token pairs into Raydium pools and earn trading fees.',
  },
  {
    type: 'removeLiquidity',
    title: 'Remove Liquidity (Raydium)',
    shortTitle: 'Remove Liquidity',
    icon: <MinusCircle className="h-4 w-4" />,
    category: 'Liquidity',
    onChain: true,
    platform: 'raydium.io/liquidity',
    platformUrl: 'Your Positions tab',
    whenToUse:
      'When exiting an LP position — burn LP tokens to receive back underlying tokens plus accumulated trading fees.',
    prerequisites: [
      'LP tokens in wallet from prior deposit',
      'SOL for transaction fees',
    ],
    manualSteps: [
      'Connect wallet → go to My Positions',
      'Select pool → choose % to remove',
      'Review output → approve tx',
      'Unwrap if needed',
    ],
    workflowVerseSteps: [
      'Drag "Remove Liquidity" onto canvas',
      'Select pool and removal percentage',
      'Connect to workflow → execute',
    ],
    example: {
      scenario: 'Remove 100% from SOL/USDC position.',
      parameters: { 'Pool': 'SOL/USDC', 'Remove %': '100%', 'Expected': '~0.5 SOL + ~50 USDC' },
    },
    tips: [
      'Partial removal (25/50/75%) keeps you earning on remaining share',
      'Check IL before removing — you may get more of the cheaper token',
    ],
    timeTraditional: '8–12 min',
    timeWorkflowVerse: '~5 min',
    description: 'Withdraw from Raydium pools by burning LP tokens.',
  },
  {
    type: 'jupiterSwap',
    title: 'Swap (Jupiter)',
    shortTitle: 'Jupiter Swap',
    icon: <Zap className="h-4 w-4" />,
    category: 'Trading',
    onChain: true,
    platform: 'jup.ag',
    platformUrl: 'jup.ag',
    whenToUse:
      'When you need the best price across all Solana DEXes. Jupiter aggregates 20+ DEXes and finds optimal routing — sometimes splitting across multiple pools.',
    prerequisites: [
      'Wallet connected',
      'SOL for fees',
      'Source token balance',
    ],
    manualSteps: [
      'Connect wallet → select tokens',
      'Enter amount → review route + price impact',
      'Set slippage → swap → confirm on-chain',
    ],
    workflowVerseSteps: [
      'Drag "Jupiter Swap" onto canvas',
      'Select tokens, amount, slippage',
      'Execute — Jupiter V6 routing automatic',
    ],
    example: {
      scenario: 'Swap 1 SOL → USDC with Jupiter aggregated best route.',
      parameters: { 'From': 'SOL', 'To': 'USDC', 'Amount': '1 SOL', 'Slippage': '50 bps' },
    },
    tips: [
      'Best for trades > $100 where route optimization matters',
      'May split trade across 2–3 DEXes for better execution',
    ],
    timeTraditional: '5–8 min',
    timeWorkflowVerse: '~3 min',
    description: 'Jupiter aggregator — optimal routing across 20+ Solana DEXes.',
  },
  {
    type: 'orcaSwap',
    title: 'Swap (Orca)',
    shortTitle: 'Orca Swap',
    icon: <ArrowRightLeft className="h-4 w-4" />,
    category: 'Trading',
    onChain: true,
    platform: 'orca.so',
    platformUrl: 'orca.so',
    whenToUse:
      'When trading on Orca\'s Whirlpool concentrated liquidity pools. Orca offers tight spreads on major Solana pairs with a clean UI.',
    prerequisites: [
      'Wallet connected',
      'SOL for fees',
      'Source token balance',
    ],
    manualSteps: [
      'Connect wallet → pick tokens',
      'Enter amount → review via Whirlpools',
      'Adjust slippage → approve → verify',
    ],
    workflowVerseSteps: [
      'Drag "Orca Swap" onto canvas',
      'Configure tokens and amount',
      'Execute in workflow',
    ],
    example: {
      scenario: 'Swap 0.1 SOL → USDC via Orca Whirlpools.',
      parameters: { 'From': 'SOL', 'To': 'USDC', 'Amount': '0.1 SOL' },
    },
    tips: [
      'Orca Whirlpools offer concentrated liquidity — tighter spreads on popular pairs',
      'Use 0.5% slippage for major pairs',
    ],
    timeTraditional: '5–10 min',
    timeWorkflowVerse: '~3 min',
    description: 'Swap via Orca\'s Whirlpool concentrated liquidity pools.',
  },
  {
    type: 'orcaOpenPosition',
    title: 'Open Position (Orca CLMM)',
    shortTitle: 'Open CLMM',
    icon: <PlusCircle className="h-4 w-4" />,
    category: 'Liquidity',
    onChain: true,
    platform: 'orca.so/pools',
    platformUrl: 'Concentrated Liquidity',
    whenToUse:
      'When providing concentrated liquidity on Orca — set a custom price range for higher capital efficiency. Earn more fees per dollar deposited compared to full-range positions.',
    prerequisites: [
      'Both tokens in wallet',
      'SOL for fees',
      'Understanding of price range / tick selection',
      'Higher risk of IL in narrow ranges',
    ],
    manualSteps: [
      'Connect wallet → find pool',
      'Set price range (lower + upper tick)',
      'Enter deposit amounts',
      'Approve token A → approve token B',
      'Open position',
    ],
    workflowVerseSteps: [
      'Drag "Orca CLMM" module onto canvas',
      'Select pool, price range, and amounts',
      'Execute — approvals and position handled automatically',
    ],
    example: {
      scenario: 'Open SOL/USDC concentrated position with ±5% range around current price.',
      parameters: { 'Pool': 'SOL/USDC', 'Lower Price': '$95', 'Upper Price': '$105', 'Deposit': '1 SOL + 100 USDC' },
    },
    tips: [
      'Narrower range = more fees but higher IL risk',
      'Rebalance when price moves out of range',
    ],
    timeTraditional: '12–20 min',
    timeWorkflowVerse: '~8 min',
    description: 'Open concentrated liquidity position on Orca Whirlpools with custom price range.',
  },
  {
    type: 'orcaClosePosition',
    title: 'Close Position (Orca CLMM)',
    shortTitle: 'Close CLMM',
    icon: <MinusCircle className="h-4 w-4" />,
    category: 'Liquidity',
    onChain: true,
    platform: 'orca.so/portfolio',
    platformUrl: 'orca.so/portfolio',
    whenToUse:
      'When exiting a concentrated liquidity position on Orca — harvest accumulated fees and withdraw deposited tokens.',
    prerequisites: [
      'Active CLMM position on Orca',
      'SOL for fees',
    ],
    manualSteps: [
      'Connect wallet → go to portfolio',
      'Select position → harvest fees',
      'Close position → verify tokens returned',
    ],
    workflowVerseSteps: [
      'Drag "Close Orca Position" onto canvas',
      'Select position to close',
      'Execute — fees harvested and position closed',
    ],
    example: {
      scenario: 'Close SOL/USDC CLMM position, collect $5.20 in fees.',
      parameters: { 'Position': 'SOL/USDC CLMM', 'Fees Collected': '~$5.20', 'Tokens Returned': '1.02 SOL + 98 USDC' },
    },
    tips: [
      'Always harvest fees before closing — some interfaces do this automatically',
      'Compare position value to "if you held" to understand IL impact',
    ],
    timeTraditional: '5–10 min',
    timeWorkflowVerse: '~4 min',
    description: 'Close Orca CLMM positions, harvest fees, and withdraw tokens.',
  },
  {
    type: 'stakeMarinade',
    title: 'Stake SOL (Marinade)',
    shortTitle: 'Marinade Stake',
    icon: <TrendingUp className="h-4 w-4" />,
    category: 'Staking',
    onChain: true,
    platform: 'marinade.finance',
    platformUrl: 'marinade.finance',
    whenToUse:
      'When you want liquid staking — deposit SOL, receive mSOL that appreciates as rewards accrue (~7% APY). mSOL stays liquid and can be used across DeFi protocols.',
    prerequisites: [
      'SOL balance in wallet',
      'SOL for fees (~0.002 SOL)',
    ],
    manualSteps: [
      'Connect wallet → enter SOL amount',
      'Review mSOL exchange rate',
      'Click stake → approve tx',
      'Verify mSOL balance',
      'Optionally deploy mSOL in DeFi',
    ],
    workflowVerseSteps: [
      'Drag "Stake SOL (Marinade)" onto canvas',
      'Enter SOL amount',
      'Connect to workflow → execute',
    ],
    example: {
      scenario: 'Stake 5 SOL via Marinade, receive mSOL for DeFi.',
      parameters: { 'SOL': '5 SOL', 'mSOL Received': '~4.73 mSOL', 'APY': '~6.8–7.2%' },
    },
    tips: [
      'mSOL is composable — use as collateral or in LP pools',
      'Marinade distributes across 400+ validators',
      'Delayed unstake returns slightly more than instant',
    ],
    timeTraditional: '8–15 min',
    timeWorkflowVerse: '~5 min',
    description: 'Liquid staking via Marinade — SOL → mSOL with ~7% APY.',
  },
  {
    type: 'stakeNative',
    title: 'Stake SOL (Native)',
    shortTitle: 'Native Stake',
    icon: <Landmark className="h-4 w-4" />,
    category: 'Staking',
    onChain: true,
    platform: 'Phantom / stakeview.app',
    platformUrl: 'stakeview.app',
    whenToUse:
      'When you want to delegate SOL directly to a specific validator. Requires more research but gives you control over validator choice and governance participation.',
    prerequisites: [
      'SOL balance for staking + rent-exempt stake account (~0.002 SOL)',
      'Validator research (performance, commission, uptime)',
    ],
    manualSteps: [
      'Open wallet → go to staking',
      'Research validators on stakeview.app',
      'Pick validator → enter amount',
      'Create stake account → delegate',
      'Wait for activation epoch (2–3 days)',
    ],
    workflowVerseSteps: [
      'Drag "Native Stake" onto canvas',
      'Select validator and SOL amount',
      'Execute — stake account + delegation in one tx',
    ],
    example: {
      scenario: 'Stake 10 SOL to a top validator via native delegation.',
      parameters: { 'SOL': '10 SOL', 'Validator': 'Top-performing, <5% commission', 'Activation': 'Next epoch (2–3 days)' },
    },
    tips: [
      'Check commission rate — most good validators charge 5–10%',
      'Stake is not liquid — need to deactivate and wait an epoch to withdraw',
      'Use stakeview.app to compare validator performance',
    ],
    timeTraditional: '15–25 min',
    timeWorkflowVerse: '~5 min',
    description: 'Native SOL staking — delegate to a specific validator.',
  },
  {
    type: 'tokenTransfer',
    title: 'Token Transfer (SPL)',
    shortTitle: 'SPL Transfer',
    icon: <Send className="h-4 w-4" />,
    category: 'Transfer',
    onChain: true,
    platform: 'Phantom wallet',
    platformUrl: 'Phantom / Solflare',
    whenToUse:
      'For sending any SPL token or native SOL to another wallet. Instant finality on Solana (~400ms).',
    prerequisites: [
      'Token/SOL balance in wallet',
      'Valid recipient address',
    ],
    manualSteps: [
      'Open wallet → select token',
      'Click send → paste address',
      'Enter amount → confirm',
      'Verify receipt',
    ],
    workflowVerseSteps: [
      'Drag "Transfer" onto canvas',
      'Enter recipient, token, and amount',
      'Execute in workflow',
    ],
    example: {
      scenario: 'Send 0.5 SOL to another wallet.',
      parameters: { 'Token': 'SOL', 'Amount': '0.5 SOL', 'To': '7xKXtg...sgAsU', 'Fee': '~0.000005 SOL' },
    },
    tips: [
      'Solana confirms in ~400ms — truly instant',
      'Transaction fees are negligible (<$0.001)',
      'Double-check addresses — transfers are irreversible',
    ],
    timeTraditional: '3–5 min',
    timeWorkflowVerse: '~2 min',
    description: 'Instant SPL token or native SOL transfer on Solana.',
  },
  /* ── Simulated (Mock) ───────────────────────────────────────────────── */
  {
    type: 'bridge',
    title: 'BTC Bridge (Mock)',
    shortTitle: 'BTC Bridge',
    icon: <Globe className="h-4 w-4" />,
    category: 'Cross-Chain',
    onChain: false,
    platform: 'portalbridge.com / debridge.finance',
    platformUrl: 'Portal / deBridge',
    whenToUse:
      'Move BTC liquidity to Solana DeFi without selling. The bridge locks BTC and mints a wrapped version on Solana. ⚠️ This is a simulated operation in WorkflowVerse.',
    prerequisites: [
      'BTC on Bitcoin mainnet',
      'Solana wallet for receiving',
      'Patience (10–30 min finality)',
    ],
    manualSteps: [
      'Open bridge UI → connect BTC + Solana wallets',
      'Select route → enter amount',
      'Approve on source chain',
      'Wait 10–30 min finality',
      'Claim on Solana → verify',
    ],
    workflowVerseSteps: [
      'Drag "BTC Bridge" onto canvas',
      'Enter amount and destination',
      'Execute — monitor phase status: awaiting_deposit -> confirming -> minting -> minted',
      'Use Retry/Cancel controls and Bridge Request logs to track heartbeat updates',
    ],
    example: {
      scenario: 'Bridge 0.01 BTC → sBTC on Solana (simulated).',
      parameters: { 'BTC': '0.01 BTC', 'Bridge': 'Portal/deBridge', 'Time': '10–30 min' },
    },
    tips: [
      '⚠️ Bridges carry smart contract risk',
      'Cross-chain finality is the bottleneck — no speedup possible',
      'On Devnet, this is simulated',
      'The Bridge panel is resumable: request ID and status logs persist across refreshes',
    ],
    timeTraditional: '45–90 min',
    timeWorkflowVerse: '~45 min',
    description: 'Cross-chain BTC → Solana bridge (simulated/mock).',
  },
  {
    type: 'claim',
    title: 'Claim Rewards',
    shortTitle: 'Claim Rewards',
    icon: <Gift className="h-4 w-4" />,
    category: 'Rewards',
    onChain: true,
    platform: 'raydium.io / orca.so / marinade.finance',
    platformUrl: 'Multiple platforms',
    whenToUse:
      'Harvest accumulated LP fee yield and staking rewards across positions. This operation executes on-chain claims when claimable positions are available.',
    prerequisites: [
      'Active positions with pending rewards',
      'SOL for claim tx fees',
    ],
    manualSteps: [
      'Open Raydium → check rewards → claim',
      'Open Orca → check rewards → claim',
      'Open Marinade → check → claim',
      '— each platform separately',
    ],
    workflowVerseSteps: [
      'Drag "Claim Rewards" onto canvas',
      'Select pools/positions to claim from',
      'Execute — claim transactions are batched in one workflow run',
    ],
    example: {
      scenario: 'Claim all rewards across Raydium, Orca, and Marinade in one operation.',
      parameters: { 'Raydium Fees': '~$2.50', 'Orca Fees': '~$1.20', 'Marinade': 'Auto-compounds (mSOL)' },
    },
    tips: [
      'Build a "claim-all" workflow to harvest everything at once',
      'Solana gas is negligible — claim frequently and compound',
    ],
    timeTraditional: '15–25 min',
    timeWorkflowVerse: '~5 min',
    description: 'Harvest rewards from DeFi positions using on-chain claim transactions.',
  },
  {
    type: 'lightning',
    title: 'Instant SOL Transfer',
    shortTitle: 'Lightning Pay',
    icon: <Zap className="h-4 w-4" />,
    category: 'Transfer',
    onChain: true,
    platform: 'Solana System Program',
    platformUrl: 'Phantom transfer signing',
    whenToUse:
      'For near-instant wallet-to-wallet SOL payments on Solana Devnet using a direct signed transfer transaction.',
    prerequisites: [
      'Lightning wallet app (Muun/Phoenix/Strike)',
      'BOLT11 invoice or recipient info',
    ],
    manualSteps: [
      'Open wallet transfer flow and paste recipient',
      'Enter SOL amount and memo',
      'Sign transfer transaction',
      'Verify confirmation and tx signature',
    ],
    workflowVerseSteps: [
      'Drag "Lightning" module onto canvas',
      'Enter recipient address and SOL amount',
      'Execute and sign the transfer prompt',
    ],
    example: {
      scenario: 'Send 0.05 SOL to a teammate wallet for settlement.',
      parameters: { Amount: '0.05 SOL', 'Network Fee': '~0.000005 SOL', Finality: '~400ms' },
    },
    tips: [
      'Lightning payments are near-instant and cost fractions of a cent',
      'BOLT11 invoices expire — use them promptly',
    ],
    timeTraditional: '5–10 min',
    timeWorkflowVerse: '~3 min',
    description: 'Real on-chain SOL transfer with instant Solana finality.',
  },
  {
    type: 'smartContract',
    title: 'Smart Contract Call (Mock)',
    shortTitle: 'Contract Call',
    icon: <Code className="h-4 w-4" />,
    category: 'Advanced',
    onChain: false,
    platform: 'Solana Explorer / custom dApp',
    platformUrl: 'Explorer or dApp UI',
    whenToUse:
      'For calling on-chain programs directly — custom instruction data, DeFi protocol interactions, or governance votes. ⚠️ Simulated in WorkflowVerse.',
    prerequisites: [
      'Program ID and instruction format known',
      'Wallet with SOL for fees',
      'Understanding of Solana program accounts',
    ],
    manualSteps: [
      'Open explorer or dApp',
      'Find program → construct instruction data manually',
      'Connect wallet → send tx → parse logs',
    ],
    workflowVerseSteps: [
      'Drag "Smart Contract" onto canvas',
      'Configure program ID, instruction, and accounts',
      'Execute — simulated contract interaction',
    ],
    example: {
      scenario: 'Call a custom DeFi program to update pool parameters.',
      parameters: { 'Program': 'CustomDeFi_v2', 'Instruction': 'update_params', 'Data': '{"fee": 25}' },
    },
    tips: [
      'Always test on Devnet before mainnet',
      'Parse transaction logs to verify instruction success',
    ],
    timeTraditional: '15–30 min',
    timeWorkflowVerse: '~5 min',
    description: 'Arbitrary Solana program invocation (simulated/mock).',
  },
  {
    type: 'httpRequest',
    title: 'HTTP Request (Mock)',
    shortTitle: 'HTTP Request',
    icon: <Globe2 className="h-4 w-4" />,
    category: 'Advanced',
    onChain: false,
    platform: 'Postman / curl / browser',
    platformUrl: 'API tools',
    whenToUse:
      'For calling external APIs within a workflow — fetch price data, trigger webhooks, or integrate with off-chain services. ⚠️ Simulated in WorkflowVerse.',
    prerequisites: [
      'API endpoint URL and credentials (if needed)',
      'Understanding of request format (JSON, headers)',
    ],
    manualSteps: [
      'Open tool (Postman/curl)',
      'Configure URL, headers, body',
      'Send → parse response',
      'Manually feed into next step',
    ],
    workflowVerseSteps: [
      'Drag "HTTP Request" onto canvas',
      'Enter URL, method, headers, body',
      'Connect output to next workflow node',
    ],
    example: {
      scenario: 'Fetch current SOL price from CoinGecko API.',
      parameters: { 'URL': 'api.coingecko.com/v3/simple/price', 'Method': 'GET', 'Params': 'ids=solana&vs=usd' },
    },
    tips: [
      'Chain HTTP requests to build data pipelines in workflows',
      'Use response data as input for conditional nodes',
    ],
    timeTraditional: '3–10 min',
    timeWorkflowVerse: '~2 min',
    description: 'External API calls within workflows (simulated/mock).',
  },
  {
    type: 'emailNotification',
    title: 'Email Notification (Mock)',
    shortTitle: 'Email Alert',
    icon: <Mail className="h-4 w-4" />,
    category: 'Advanced',
    onChain: false,
    platform: 'Gmail / SMTP client',
    platformUrl: 'Email client',
    whenToUse:
      'Send email notifications when workflow steps complete — e.g., alert when a swap executes or when rewards are claimed. ⚠️ Simulated in WorkflowVerse.',
    prerequisites: [
      'Email recipient address',
      'SMTP configuration (in production)',
    ],
    manualSteps: [
      'Open email client → compose',
      'Attach DeFi results manually → send',
    ],
    workflowVerseSteps: [
      'Drag "Email" onto canvas',
      'Enter recipient, subject, body template',
      'Connect after any workflow step',
    ],
    example: {
      scenario: 'Send email alert after a swap completes.',
      parameters: { 'To': 'user@example.com', 'Subject': 'Swap Complete', 'Body': 'Swapped 1 SOL → $X USDC' },
    },
    tips: [
      'Use template variables like {{amount}} and {{token}} in email body',
      'Great for monitoring automated/scheduled workflows',
    ],
    timeTraditional: '3–5 min',
    timeWorkflowVerse: '~1 min',
    description: 'Automated email notifications on workflow events (simulated).',
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Categories & styling
   ═══════════════════════════════════════════════════════════════════════════ */

const CATEGORIES = ['Automation', 'Trading', 'Liquidity', 'Staking', 'Rewards', 'Transfer', 'Cross-Chain', 'Advanced'];

const CAT_DOT: Record<string, string> = {
  Automation: 'bg-teal-400',
  Trading: 'bg-blue-400', Liquidity: 'bg-purple-400', Staking: 'bg-green-400',
  Rewards: 'bg-amber-400', Transfer: 'bg-cyan-400', 'Cross-Chain': 'bg-orange-400', Advanced: 'bg-pink-400',
};

const CAT_BADGE: Record<string, string> = {
  Automation: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  Trading: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Liquidity: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  Staking: 'bg-green-500/15 text-green-400 border-green-500/30',
  Rewards: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Transfer: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  'Cross-Chain': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Advanced: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
};

/* ═══════════════════════════════════════════════════════════════════════════
   Collapsible section
   ═══════════════════════════════════════════════════════════════════════════ */

function Section({
  title, icon, children, defaultOpen = true,
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
      >
        {icon}
        <span className="font-semibold text-sm flex-1">{title}</span>
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="px-4 py-3 text-sm leading-relaxed">{children}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════════════════════ */

interface OperationManualProps {
  open: boolean;
  onClose: () => void;
  selectedType?: string;
}

export function OperationManual({ open, onClose, selectedType }: OperationManualProps) {
  const [activeType, setActiveType] = useState(selectedType || 'swap');

  useEffect(() => {
    if (selectedType) setActiveType(selectedType);
  }, [selectedType]);

  const op = OPERATIONS.find((o) => o.type === activeType) || OPERATIONS[0];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[960px] p-0 gap-0 overflow-hidden flex flex-col" style={{ height: '82vh', maxHeight: '82vh' }}>
        <div className="flex flex-1 min-h-0">
          {/* ── Left: Table of Contents ─────────────────────────────── */}
          <div className="w-52 shrink-0 border-r border-border bg-muted/30 flex flex-col h-full">
            {/* Book title */}
            <div className="px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <span className="font-bold text-sm">Operation Manual</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {OPERATIONS.filter(o => o.onChain).length} on-chain · {OPERATIONS.filter(o => !o.onChain).length} simulated
              </p>
            </div>

            {/* Category list — scrollable */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="py-1">
                {CATEGORIES.map((cat) => {
                  const ops = OPERATIONS.filter((o) => o.category === cat);
                  if (ops.length === 0) return null;
                  return (
                    <div key={cat} className="mb-0.5">
                      <div className="flex items-center gap-2 px-4 py-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${CAT_DOT[cat]}`} />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                          {cat}
                        </span>
                      </div>
                      {ops.map((o) => (
                        <button
                          key={o.type}
                          onClick={() => setActiveType(o.type)}
                          className={`w-full flex items-center gap-2 px-4 py-1.5 text-left text-[13px] transition-colors ${
                            activeType === o.type
                              ? 'bg-primary/10 text-primary font-medium border-r-2 border-primary'
                              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          }`}
                        >
                          {o.icon}
                          <span className="truncate">{o.shortTitle}</span>
                          {!o.onChain && (
                            <span className="ml-auto text-[8px] text-muted-foreground bg-muted px-1 rounded">mock</span>
                          )}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-border shrink-0">
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onClose}>
                Close Manual
              </Button>
            </div>
          </div>

          {/* ── Right: Content Page — scrollable ────────────────────── */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-6 space-y-4 max-w-[680px]">
              {/* Header area */}
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] ${CAT_BADGE[op.category]}`}>
                    {op.category}
                  </Badge>
                  {op.onChain ? (
                    <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-400 border-green-500/30">
                      🔗 On-chain
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                      🧪 Simulated
                    </Badge>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                    <Clock className="h-3 w-3" />
                    <span className="text-red-400 line-through">{op.timeTraditional}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="text-green-400 font-semibold">{op.timeWorkflowVerse}</span>
                  </div>
                </div>
                <h2 className="text-2xl font-bold">{op.title}</h2>
                <p className="text-muted-foreground text-sm mt-1">{op.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Traditional platform: <span className="font-mono text-foreground">{op.platform}</span>
                </p>
              </div>

              <hr className="border-border" />

              {/* When to Use */}
              <Section title="When to Use" icon={<Info className="h-4 w-4 text-blue-400" />}>
                <p className="text-muted-foreground">{op.whenToUse}</p>
              </Section>

              {/* Prerequisites */}
              <Section title="Prerequisites" icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}>
                <ul className="space-y-1.5">
                  {op.prerequisites.map((req, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{req}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              {/* Manual Steps */}
              <Section title="Manual Steps (Traditional)" icon={<span className="text-sm">📋</span>} defaultOpen={false}>
                <ol className="space-y-1 list-decimal list-inside text-muted-foreground">
                  {op.manualSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </Section>

              {/* WorkflowVerse Steps */}
              <Section title="How to Use in WorkflowVerse" icon={<Zap className="h-4 w-4 text-primary" />}>
                <ol className="space-y-1 list-decimal list-inside text-muted-foreground">
                  {op.workflowVerseSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </Section>

              {/* Example */}
              <Section title="Real Example" icon={<Lightbulb className="h-4 w-4 text-amber-400" />}>
                <p className="text-muted-foreground italic mb-2">{op.example.scenario}</p>
                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <tbody>
                      {Object.entries(op.example.parameters).map(([key, val], i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-3 py-1.5 font-medium text-muted-foreground bg-muted/50 w-[110px]">{key}</td>
                          <td className="px-3 py-1.5 font-mono">{val}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>

              {/* Tips */}
              <Section title="Tips & Pitfalls" icon={<Lightbulb className="h-4 w-4 text-yellow-400" />} defaultOpen={false}>
                <ul className="space-y-1.5">
                  {op.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-yellow-400 mt-0.5 shrink-0">•</span>
                      <span className="text-muted-foreground">{tip}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              {/* Time card */}
              <div className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
                <Clock className="h-5 w-5 text-green-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Time Savings</p>
                  <p className="text-sm mt-0.5">
                    <span className="text-red-400 font-bold">{op.timeTraditional}</span>
                    <span className="text-muted-foreground mx-2">→</span>
                    <span className="text-green-400 font-bold">{op.timeWorkflowVerse}</span>
                    <span className="text-muted-foreground"> with WorkflowVerse</span>
                  </p>
                </div>
              </div>

              {/* Total summary */}
              <div className="p-4 rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground text-sm mb-1">📊 Total across all operations</p>
                <p>
                  Traditional: <span className="text-red-400 font-bold">~170–320 min</span> across 8+ platforms
                </p>
                <p>
                  WorkflowVerse: <span className="text-green-400 font-bold">~56 min</span> — single platform, one visual editor
                </p>
                <p className="mt-2 italic text-[11px]">
                  The biggest savings come from eliminating context switching across 8+ platforms.
                  A full workflow (swap → add LP → stake → claim) takes 40+ min across 3 platforms traditionally,
                  but runs as a single connected flow in WorkflowVerse.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
