import { ModuleCard } from "./modules/ModuleCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModuleType } from "@shared/schema";
import { PresetWorkflows } from './PresetWorkflows';

type ModuleInfo = {
  type: ModuleType;
  title: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  status: "full" | "partial" | "demo";
  example: string;
  useCase: string;
};

const MODULES: ModuleInfo[] = [
  {
    type: "swap",
    title: "Swap",
    description: "Exchange tokens via Jupiter",
    icon: "swap_horiz",
    color: "#3165F5",
    bgColor: "rgba(49, 101, 245, 0.2)",
    status: "full",
    example: "Swap 1 SOL → USDC on Solana Devnet using Jupiter aggregator for best price routing.",
    useCase: "Rebalancing your portfolio, taking profits, or entering a new DeFi position without manual DEX navigation.",
  },
  {
    type: "liquidityPool",
    title: "Liquidity Pool",
    description: "Add or remove liquidity",
    icon: "water_drop",
    color: "#06B6D4",
    bgColor: "rgba(6, 182, 212, 0.2)",
    status: "full",
    example: "Manage SOL/USDC pool operations — configure add or remove in a single unified node.",
    useCase: "Automating pool rebalancing as part of a larger workflow; sends a real on-chain tx with confirmed Solana signature.",
  },
  {
    type: "addLiquidity",
    title: "Add Liquidity",
    description: "Provide liquidity to pools",
    icon: "add_circle",
    color: "#06B6D4",
    bgColor: "rgba(6, 182, 212, 0.2)",
    status: "full",
    example: "Deposit 0.5 SOL + 10 USDC into a SOL/USDC pool, receive LP tokens, track position + accrued rewards.",
    useCase: "Earning a share of trading fees. LP position persists across sessions; rewards accumulate based on pool APR.",
  },
  {
    type: "removeLiquidity",
    title: "Remove Liquidity",
    description: "Withdraw from pools",
    icon: "remove_circle",
    color: "#EF4444",
    bgColor: "rgba(239, 68, 68, 0.2)",
    status: "full",
    example: "Burn 5 LP tokens to reclaim proportional SOL + USDC from a pool with real on-chain confirmation.",
    useCase: "Exiting a liquidity position. Updates your tracked LP balance and sends a confirmed Solana transaction.",
  },
  {
    type: "stake",
    title: "Stake",
    description: "Stake SOL via Marinade",
    icon: "lock",
    color: "#10B981",
    bgColor: "rgba(16, 185, 129, 0.2)",
    status: "full",
    example: "Delegate 2 SOL to a validator via Marinade protocol and earn ~7% APY staking rewards.",
    useCase: "Passively earning yield on idle SOL without picking or managing individual validators yourself.",
  },
  {
    type: "claim",
    title: "Claim Rewards",
    description: "Harvest your rewards",
    icon: "redeem",
    color: "#7C3AED",
    bgColor: "rgba(124, 58, 237, 0.2)",
    status: "full",
    example: "Claim accumulated LP fee rewards from all pools you have positions in; rewards are calculated from pool APR × days elapsed.",
    useCase: "Compounding yield in a workflow: Add Liquidity → wait → Claim Rewards → Swap → Stake, all in one automated run.",
  },
  {
    type: "bridge",
    title: "BTC Bridge",
    description: "Bridge BTC to sBTC",
    icon: "bridge",
    color: "#F59E0B",
    bgColor: "rgba(245, 158, 11, 0.2)",
    status: "demo",
    example: "Bridge 0.01 BTC from Bitcoin mainnet to sBTC on Solana for use in DeFi protocols.",
    useCase: "Bringing Bitcoin liquidity into the Solana ecosystem to access DeFi yield without selling BTC.",
  },
  {
    type: "lightning",
    title: "Lightning",
    description: "Instant SOL transfer",
    icon: "bolt",
    color: "#F59E0B",
    bgColor: "rgba(245, 158, 11, 0.2)",
    status: "full",
    example: "Send 0.1 SOL instantly to any wallet address via Solana System Program with an optional memo.",
    useCase: "Fast SOL payments between wallets, funding sub-wallets, or routing funds as a workflow step.",
  },
  {
    type: "orcaSwap",
    title: "Orca Swap",
    description: "Swap via Orca Whirlpools CLMM",
    icon: "waves",
    color: "#06D6A0",
    bgColor: "rgba(6, 214, 160, 0.2)",
    status: "full",
    example: "Swap SOL → USDC through Orca Whirlpools concentrated liquidity market maker on devnet.",
    useCase: "Accessing Orca's CLMM pools for tighter spreads on stable pairs; falls back to mock swap on devnet if no pool exists.",
  },
  {
    type: "raydiumSwap",
    title: "Raydium Swap",
    description: "Swap via Raydium CPMM pool",
    icon: "hub",
    color:("#5F45FF"),
    bgColor: "rgba(95, 69, 255, 0.2)",
    status: "full",
    example: "Swap tokens through a Raydium CPMM pool — uses any custom pool you created via Create Pool.",
    useCase: "Routing swaps through your own Raydium CPMM pool on devnet; automatically falls back to mock if no pool is registered.",
  },
  {
    type: "tokenCreation",
    title: "Create Token",
    description: "Mint a new SPL token",
    icon: "toll",
    color: "#F97316",
    bgColor: "rgba(249, 115, 22, 0.2)",
    status: "full",
    example: "Create a new SPL token with 6 decimals and mint 1,000,000 initial supply to your wallet on devnet.",
    useCase: "Bootstrapping a new token for testing a DEX pool, reward program, or governance experiment.",
  },
];

const CATEGORIES = [
  {
    name: "Core Operations",
    modules: ["swap", "liquidityPool", "addLiquidity", "removeLiquidity", "stake", "claim"],
  },
  {
    name: "Solana DeFi",
    modules: ["orcaSwap", "raydiumSwap", "tokenCreation"],
  },
  {
    name: "Bitcoin Operations",
    modules: ["bridge", "lightning"],
  },
];

export function ModuleLibrary() {
  return (
    <div className="w-64 bg-card overflow-y-auto flex-shrink-0 border-r border-border hidden md:block">
      <ScrollArea className="h-full">
        <div className="p-4 space-y-5">
          <PresetWorkflows />
          <div className="border-t border-border" />
          <div>
          <h2 className="text-sm font-semibold mb-3">Module Library</h2>

          <div className="space-y-4">
            {CATEGORIES.map((category) => (
              <div key={category.name}>
                <div className="mb-2 text-xs uppercase text-muted-foreground font-medium">
                  {category.name}
                </div>

                <div className="space-y-3">
                  {MODULES
                    .filter((module) => category.modules.includes(module.type))
                    .map((module) => (
                      <ModuleCard
                        key={module.type}
                        type={module.type}
                        title={module.title}
                        description={module.description}
                        icon={module.icon}
                        color={module.color}
                        bgColor={module.bgColor}
                        status={module.status}
                        example={module.example}
                        useCase={module.useCase}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
