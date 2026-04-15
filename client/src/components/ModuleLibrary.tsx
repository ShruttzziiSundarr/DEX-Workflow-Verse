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
  badge: "On-chain" | "Hybrid" | "Simulated";
  example: string;
  useCase: string;
};

const MODULES: ModuleInfo[] = [
  // ─── Trading ───────────────────────────────────────────────────────
  {
    type: "swap",
    title: "Swap Tokens",
    description: "Exchange tokens via Jupiter, Raydium, or Orca",
    icon: "swap_horiz",
    color: "#3165F5",
    bgColor: "rgba(49, 101, 245, 0.2)",
    status: "full",
    badge: "On-chain",
    example: "Swap 1 SOL → USDC. Choose your preferred protocol in the config panel — Jupiter (auto-route), Raydium CPMM, or Orca Whirlpools.",
    useCase: "Rebalancing your portfolio, taking profits, or entering a new DeFi position.",
  },

  // ─── Liquidity ─────────────────────────────────────────────────────
  {
    type: "liquidity",
    title: "Liquidity Pool",
    description: "Manage pools — add, remove, or create",
    icon: "water_drop",
    color: "#06B6D4",
    bgColor: "rgba(6, 182, 212, 0.2)",
    status: "full",
    badge: "On-chain",
    example: "Add liquidity to SOL/USDC, remove LP tokens, or create a new Raydium CPMM pool for custom tokens.",
    useCase: "Earning trading fees by providing liquidity. Choose action and protocol (Raydium or Orca) in config.",
  },

  // ─── Staking ───────────────────────────────────────────────────────
  {
    type: "stake",
    title: "Stake SOL",
    description: "Stake via Native validators or Marinade",
    icon: "lock",
    color: "#10B981",
    bgColor: "rgba(16, 185, 129, 0.2)",
    status: "full",
    badge: "On-chain",
    example: "Delegate 2 SOL to a validator and earn ~7% APY staking rewards.",
    useCase: "Passively earning yield on idle SOL. Choose Native Staking (pick validator) or Marinade (auto-distributed).",
  },
  {
    type: "claim",
    title: "Claim Rewards",
    description: "Harvest LP fee rewards",
    icon: "redeem",
    color: "#7C3AED",
    bgColor: "rgba(124, 58, 237, 0.2)",
    status: "full",
    badge: "Hybrid",
    example: "Claim accumulated LP fee rewards from all pools you have positions in.",
    useCase: "Compounding yield: Add Liquidity → wait → Claim Rewards → Swap → Stake.",
  },
  {
    type: "autoEarn",
    title: "Auto-Earn Vault",
    description: "1-click Swap → LP → Stake automation",
    icon: "auto_awesome",
    color: "#14B8A6",
    bgColor: "rgba(20, 184, 166, 0.2)",
    status: "full",
    badge: "Hybrid",
    example: "Deposit SOL once and let the engine automatically split it into swap, liquidity provisioning, and staking transactions.",
    useCase: "Best for standard users who want managed DeFi yield setup without manually configuring each module.",
  },

  // ─── Utility ───────────────────────────────────────────────────────
  {
    type: "tokenCreation",
    title: "Create Token",
    description: "Mint a new SPL token on Solana",
    icon: "toll",
    color: "#F97316",
    bgColor: "rgba(249, 115, 22, 0.2)",
    status: "full",
    badge: "On-chain",
    example: "Create a new SPL token with 6 decimals and mint 1,000,000 initial supply to your wallet.",
    useCase: "Bootstrapping a test token for pool creation, reward programs, or governance experiments.",
  },
  {
    type: "transfer",
    title: "Transfer",
    description: "Send SOL or tokens to a wallet",
    icon: "send",
    color: "#F59E0B",
    bgColor: "rgba(245, 158, 11, 0.2)",
    status: "full",
    badge: "On-chain",
    example: "Send 0.1 SOL instantly to any wallet address via Solana System Program with an optional memo.",
    useCase: "Fast SOL payments, funding sub-wallets, or routing funds as a workflow step.",
  },
  {
    type: "bridge",
    title: "BTC Bridge",
    description: "Bridge BTC to sBTC (simulated)",
    icon: "bridge",
    color: "#94A3B8",
    bgColor: "rgba(148, 163, 184, 0.15)",
    status: "demo",
    badge: "Simulated",
    example: "Bridge 0.01 BTC from Bitcoin mainnet to sBTC on Solana for use in DeFi protocols.",
    useCase: "Demonstrates cross-chain bridging workflows. Fully simulated — no real bridge protocol connected.",
  },
];

const CATEGORIES = [
  {
    name: "Trading",
    icon: "trending_up",
    modules: ["swap"],
  },
  {
    name: "Liquidity & Yield",
    icon: "account_balance",
    modules: ["liquidity", "stake", "claim", "autoEarn"],
  },
  {
    name: "Utility",
    icon: "build",
    modules: ["tokenCreation", "transfer", "bridge"],
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
                <div className="mb-2 flex items-center gap-1.5 text-xs uppercase text-muted-foreground font-medium">
                  <span className="material-icons text-[14px]">{category.icon}</span>
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
