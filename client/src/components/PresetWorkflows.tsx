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
    name: 'DeFi Starter',
    description: 'Swap SOL → USDC, then add both tokens to the liquidity pool',
    icon: 'rocket_launch',
    color: '#3165F5',
    tags: ['Swap', 'Liquidity'],
    nodes: [
      {
        id: 'preset-swap-1',
        type: 'workflowNode',
        position: { x: 80, y: 180 },
        data: {
          type: 'swap',
          label: 'Swap',
          config: { sourceToken: 'SOL', targetToken: 'USDC', amount: '1', slippage: '1' },
        },
      },
      {
        id: 'preset-lp-1',
        type: 'workflowNode',
        position: { x: 340, y: 180 },
        data: {
          type: 'addLiquidity',
          label: 'Add Liquidity',
          config: { tokenA: 'SOL', tokenB: 'USDC', amountA: '1', amountB: '150', slippage: '1' },
        },
      },
    ],
    edges: [makeEdge('pe-1', 'preset-swap-1', 'preset-lp-1')],
  },
  {
    name: 'Yield Maximizer',
    description: 'Swap SOL → USDC, then stake remaining SOL for yield',
    icon: 'trending_up',
    color: '#10B981',
    tags: ['Swap', 'Stake'],
    nodes: [
      {
        id: 'preset-swap-2',
        type: 'workflowNode',
        position: { x: 80, y: 180 },
        data: {
          type: 'swap',
          label: 'Swap',
          config: { sourceToken: 'SOL', targetToken: 'USDC', amount: '0.5', slippage: '1' },
        },
      },
      {
        id: 'preset-stake-2',
        type: 'workflowNode',
        position: { x: 340, y: 180 },
        data: {
          type: 'stake',
          label: 'Stake',
          config: { action: 'delegate', amount: '1', asset: 'SOL' },
        },
      },
    ],
    edges: [makeEdge('pe-2', 'preset-swap-2', 'preset-stake-2')],
  },
  {
    name: 'Full DeFi Loop',
    description: 'Swap → Add Liquidity → Stake SOL in one automated workflow',
    icon: 'loop',
    color: '#7C3AED',
    tags: ['Swap', 'Liquidity', 'Stake'],
    nodes: [
      {
        id: 'preset-swap-3',
        type: 'workflowNode',
        position: { x: 60, y: 180 },
        data: {
          type: 'swap',
          label: 'Swap',
          config: { sourceToken: 'SOL', targetToken: 'USDC', amount: '1', slippage: '1' },
        },
      },
      {
        id: 'preset-lp-3',
        type: 'workflowNode',
        position: { x: 300, y: 180 },
        data: {
          type: 'addLiquidity',
          label: 'Add Liquidity',
          config: { tokenA: 'SOL', tokenB: 'USDC', amountA: '1', amountB: '150', slippage: '1' },
        },
      },
      {
        id: 'preset-stake-3',
        type: 'workflowNode',
        position: { x: 540, y: 180 },
        data: {
          type: 'stake',
          label: 'Stake',
          config: { action: 'delegate', amount: '2', asset: 'SOL' },
        },
      },
    ],
    edges: [
      makeEdge('pe-3a', 'preset-swap-3', 'preset-lp-3'),
      makeEdge('pe-3b', 'preset-lp-3', 'preset-stake-3'),
    ],
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
