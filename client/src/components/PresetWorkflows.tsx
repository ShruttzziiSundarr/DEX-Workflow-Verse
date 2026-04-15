import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useWorkflow } from '@/hooks/use-workflow';
import { useToast } from '@/hooks/use-toast';
import { MarkerType, Node, Edge } from 'reactflow';

interface Preset {
  name: string;
  description: string;
  icon: string;
  color: string;
  tags: string[];
  nodes: Node[];
  edges: Edge[];
}

const makeEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
  type: 'smoothstep',
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed },
  style: { stroke: 'rgba(255,255,255,0.5)', strokeWidth: 2 },
});

export const PRESETS: Preset[] = [
  {
    name: 'Devnet Pool Setup',
    description: 'Required on Devnet: Mint custom tokens and deploy a Raydium pool before swapping',
    icon: 'build',
    color: '#F59E0B',
    tags: ['Create Token', 'Liquidity'],
    nodes: [
      {
        id: 'preset-mint-1',
        type: 'workflowNode',
        position: { x: 50, y: 190 },
        data: {
          type: 'tokenCreation',
          label: 'Mint Token A',
          config: { symbol: 'TKN-A', decimals: '6', initialSupply: '1000000' },
        },
      },
      {
        id: 'preset-mint-2',
        type: 'workflowNode',
        position: { x: 50, y: 300 },
        data: {
          type: 'tokenCreation',
          label: 'Mint Token B',
          config: { symbol: 'TKN-B', decimals: '6', initialSupply: '1000000' },
        },
      },
      {
        id: 'preset-cp-1',
        type: 'workflowNode',
        position: { x: 350, y: 240 },
        data: {
          type: 'liquidity',
          label: 'Create Raydium Pool',
          config: { protocol: 'raydium', action: 'createPool', amountA: '10000', amountB: '10000', slippage: '1' },
        },
      },
    ],
    edges: [
      makeEdge('pe-c1', 'preset-mint-1', 'preset-cp-1'),
      makeEdge('pe-c2', 'preset-mint-2', 'preset-cp-1'),
    ],
  },
  {
    name: 'Mainnet Swap & Stake',
    description: 'Standard Mainnet flow: Swap tokens and delegate to a validator for yield',
    icon: 'trending_up',
    color: '#10B981',
    tags: ['Swap', 'Stake'],
    nodes: [
      {
        id: 'preset-main-swap',
        type: 'workflowNode',
        position: { x: 80, y: 180 },
        data: {
          type: 'swap',
          label: 'Swap (Mainnet)',
          config: { protocol: 'jupiter', sourceToken: 'SOL', targetToken: 'USDC', amount: '0.5', slippage: '1' },
        },
      },
      {
        id: 'preset-main-stake',
        type: 'workflowNode',
        position: { x: 340, y: 180 },
        data: {
          type: 'stake',
          label: 'Stake',
          config: { protocol: 'native', action: 'delegate', amount: '1', asset: 'SOL' },
        },
      },
    ],
    edges: [makeEdge('pe-ms', 'preset-main-swap', 'preset-main-stake')],
  },
  {
    name: 'Auto-Earn Vault (Balanced)',
    description: 'One-click vault strategy that orchestrates swap, LP provisioning, and staking in a single intent node',
    icon: 'auto_awesome',
    color: '#14B8A6',
    tags: ['Auto-Earn', 'Liquidity', 'Stake'],
    nodes: [
      {
        id: 'preset-ae-1',
        type: 'workflowNode',
        position: { x: 180, y: 220 },
        data: {
          type: 'autoEarn',
          label: 'Auto-Earn Vault',
          config: {
            moduleName: 'Balanced Auto-Earn Vault',
            asset: 'SOL',
            amount: '2.0',
            riskProfile: 'balanced',
          },
        },
      },
      {
        id: 'preset-ae-2',
        type: 'workflowNode',
        position: { x: 470, y: 220 },
        data: {
          type: 'claim',
          label: 'Claim LP Yield',
          config: {
            moduleName: 'Claim Rewards',
            fromPool: 'Liquidity Pool',
            token: 'LP-TOKEN',
            autoReinvest: true,
          },
        },
      },
    ],
    edges: [makeEdge('pe-ae-1', 'preset-ae-1', 'preset-ae-2')],
  },
  {
    name: 'Treasury Growth Loop',
    description: 'Structured treasury workflow: rebalance exposure, deploy liquidity, and harvest rewards',
    icon: 'account_balance',
    color: '#7C3AED',
    tags: ['Swap', 'Liquidity', 'Claim'],
    nodes: [
      {
        id: 'preset-tg-1',
        type: 'workflowNode',
        position: { x: 40, y: 200 },
        data: {
          type: 'swap',
          label: 'Rebalance SOL → USDC',
          config: {
            protocol: 'raydium',
            sourceToken: 'SOL',
            targetToken: 'USDC',
            amount: '1.5',
            slippage: '1',
          },
        },
      },
      {
        id: 'preset-tg-2',
        type: 'workflowNode',
        position: { x: 320, y: 200 },
        data: {
          type: 'liquidity',
          label: 'Add SOL/USDC Liquidity',
          config: {
            protocol: 'raydium',
            action: 'addLiquidity',
            tokenA: 'SOL',
            tokenB: 'USDC',
            amountA: '1.0',
            amountB: '150.0',
            slippage: '1',
          },
        },
      },
      {
        id: 'preset-tg-3',
        type: 'workflowNode',
        position: { x: 600, y: 200 },
        data: {
          type: 'claim',
          label: 'Harvest Yield',
          config: {
            moduleName: 'Claim Rewards',
            fromPool: 'Yield Farm',
            token: 'YIELD',
            autoReinvest: false,
          },
        },
      },
    ],
    edges: [
      makeEdge('pe-tg-1', 'preset-tg-1', 'preset-tg-2'),
      makeEdge('pe-tg-2', 'preset-tg-2', 'preset-tg-3'),
    ],
  },
  {
    name: 'Liquidity + Validator Mix',
    description: 'Split strategy with liquidity deployment followed by native SOL staking for balanced exposure',
    icon: 'tune',
    color: '#06B6D4',
    tags: ['Liquidity', 'Stake'],
    nodes: [
      {
        id: 'preset-ls-1',
        type: 'workflowNode',
        position: { x: 90, y: 210 },
        data: {
          type: 'liquidity',
          label: 'Deploy Liquidity',
          config: {
            protocol: 'raydium',
            action: 'addLiquidity',
            tokenA: 'SOL',
            tokenB: 'USDT',
            amountA: '0.8',
            amountB: '120.0',
            slippage: '1',
          },
        },
      },
      {
        id: 'preset-ls-2',
        type: 'workflowNode',
        position: { x: 380, y: 210 },
        data: {
          type: 'stake',
          label: 'Delegate Remaining SOL',
          config: {
            moduleName: 'Stake SOL',
            protocol: 'native',
            action: 'delegate',
            asset: 'SOL',
            amount: '1.2',
            autoCompound: true,
          },
        },
      },
    ],
    edges: [makeEdge('pe-ls-1', 'preset-ls-1', 'preset-ls-2')],
  },
  {
    name: 'Instant Payment + Re-entry',
    description: 'Send fast settlement transfer and immediately rotate remaining capital into a new position',
    icon: 'bolt',
    color: '#F59E0B',
    tags: ['Lightning', 'Swap'],
    nodes: [
      {
        id: 'preset-ip-1',
        type: 'workflowNode',
        position: { x: 70, y: 205 },
        data: {
          type: 'lightning',
          label: 'Instant SOL Transfer',
          config: {
            moduleName: 'Lightning Payment',
            recipient: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
            amount: '0.05',
            memo: 'Supplier settlement',
          },
        },
      },
      {
        id: 'preset-ip-2',
        type: 'workflowNode',
        position: { x: 350, y: 205 },
        data: {
          type: 'swap',
          label: 'Re-enter via Swap',
          config: {
            protocol: 'raydium',
            sourceToken: 'SOL',
            targetToken: 'USDC',
            amount: '0.7',
            slippage: '1',
          },
        },
      },
    ],
    edges: [makeEdge('pe-ip-1', 'preset-ip-1', 'preset-ip-2')],
  },
];

export function PresetWorkflows({ onLoad }: { onLoad?: () => void }) {
  const { setNodes, setEdges } = useWorkflow();
  const { toast } = useToast();

  const loadPreset = (preset: Preset) => {
    setNodes(preset.nodes);
    setEdges(preset.edges);
    toast({ title: `"${preset.name}" loaded`, description: preset.description });
    onLoad?.();
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium px-1">
        Quick Start Presets
      </p>
      {PRESETS.map((preset) => (
        <Card
          key={preset.name}
          className="p-3 border border-border bg-card hover:bg-accent/30 transition-colors cursor-pointer group"
          onClick={() => loadPreset(preset)}
        >
          <div className="flex items-start gap-2.5">
            <div
              className="p-1.5 rounded-md shrink-0"
              style={{ backgroundColor: `${preset.color}22` }}
            >
              <span className="material-icons text-sm" style={{ color: preset.color }}>
                {preset.icon}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold leading-tight">{preset.name}</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">
                {preset.description}
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {preset.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <span className="material-icons text-xs text-muted-foreground group-hover:text-foreground transition-colors mt-0.5">
              arrow_forward
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
