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
  }
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
