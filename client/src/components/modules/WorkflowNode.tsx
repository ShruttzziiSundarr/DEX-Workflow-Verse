import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { ModuleType } from "@shared/schema";

interface NodeData {
  type: ModuleType;
  label: string;
  config?: any;
  executionStatus?: 'idle' | 'running' | 'success' | 'failed';
}

const getNodeStyles = (type: ModuleType) => {
  switch (type) {
    case "swap":
      return { backgroundColor: "rgba(49, 101, 245, 0.2)", borderLeft: "4px solid #3165F5", icon: "swap_horiz", iconColor: "#3165F5" };
    case "liquidity":
    case "addLiquidity":
      return { backgroundColor: "rgba(6, 182, 212, 0.2)", borderLeft: "4px solid #06B6D4", icon: "water_drop", iconColor: "#06B6D4" };
    case "liquidityPool":
      return { backgroundColor: "rgba(6, 182, 212, 0.2)", borderLeft: "4px solid #06B6D4", icon: "water_drop", iconColor: "#06B6D4" };
    case "removeLiquidity":
      return { backgroundColor: "rgba(239, 68, 68, 0.2)", borderLeft: "4px solid #EF4444", icon: "remove_circle", iconColor: "#EF4444" };
    case "stake":
      return { backgroundColor: "rgba(16, 185, 129, 0.2)", borderLeft: "4px solid #10B981", icon: "lock", iconColor: "#10B981" };
    case "claim":
      return { backgroundColor: "rgba(124, 58, 237, 0.2)", borderLeft: "4px solid #7C3AED", icon: "redeem", iconColor: "#7C3AED" };
    case "autoEarn":
      return { backgroundColor: "rgba(20, 184, 166, 0.2)", borderLeft: "4px solid #14B8A6", icon: "auto_awesome", iconColor: "#14B8A6" };
    case "bridge":
      return { backgroundColor: "rgba(245, 158, 11, 0.2)", borderLeft: "4px solid #F59E0B", icon: "bridge", iconColor: "#F59E0B" };
    case "lightning":
      return { backgroundColor: "rgba(245, 158, 11, 0.2)", borderLeft: "4px solid #F59E0B", icon: "bolt", iconColor: "#F59E0B" };
    case "orcaSwap":
      return { backgroundColor: "rgba(6, 214, 160, 0.2)", borderLeft: "4px solid #06D6A0", icon: "waves", iconColor: "#06D6A0" };
    case "raydiumSwap":
      return { backgroundColor: "rgba(95, 69, 255, 0.2)", borderLeft: "4px solid #5F45FF", icon: "hub", iconColor: "#5F45FF" };
    case "tokenCreation":
      return { backgroundColor: "rgba(249, 115, 22, 0.2)", borderLeft: "4px solid #F97316", icon: "toll", iconColor: "#F97316" };
    default:
      return { backgroundColor: "rgba(75, 85, 99, 0.2)", borderLeft: "4px solid #4B5563", icon: "settings", iconColor: "#4B5563" };
  }
};

const getExecutionOverlay = (status: NodeData['executionStatus']) => {
  switch (status) {
    case 'running':
      return {
        boxShadow: '0 0 0 2px #F59E0B, 0 0 16px rgba(245, 158, 11, 0.5)',
        statusIcon: 'hourglass_top',
        statusColor: '#F59E0B',
        pulse: true,
      };
    case 'success':
      return {
        boxShadow: '0 0 0 2px #10B981, 0 0 16px rgba(16, 185, 129, 0.5)',
        statusIcon: 'check_circle',
        statusColor: '#10B981',
        pulse: false,
      };
    case 'failed':
      return {
        boxShadow: '0 0 0 2px #EF4444, 0 0 16px rgba(239, 68, 68, 0.5)',
        statusIcon: 'error',
        statusColor: '#EF4444',
        pulse: false,
      };
    default:
      return { boxShadow: 'none', statusIcon: null, statusColor: null, pulse: false };
  }
};

const getNodeContent = (type: ModuleType, config: any) => {
  switch (type) {
    case "swap":
      return (
        <>
          <div className="flex justify-between items-center mb-1">
            <span>From:</span>
            <span className="font-mono">{config?.sourceToken === 'CUSTOM' ? config?.sourceMint || 'CUSTOM' : config?.sourceToken || 'SOL'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>To:</span>
            <span className="font-mono">{config?.targetToken === 'CUSTOM' ? config?.targetMint || 'CUSTOM' : config?.targetToken || 'USDC'}</span>
          </div>
        </>
      );
    case "liquidity":
    case "addLiquidity":
    case "liquidityPool":
      return (
        <>
          <div className="flex justify-between items-center mb-1">
            <span>Token A:</span>
            <span className="font-mono">{config?.tokenA || "SOL"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Token B:</span>
            <span className="font-mono">{config?.tokenB || "USDC"}</span>
          </div>
        </>
      );
    case "removeLiquidity":
      return (
        <div className="flex justify-between items-center">
          <span>Pool:</span>
          <span className="font-mono">{config?.tokenA || "SOL"}/{config?.tokenB || "USDC"}</span>
        </div>
      );
    case "stake":
      return (
        <>
          <div className="flex justify-between items-center mb-1">
            <span>Action:</span>
            <span className="font-mono capitalize">{config?.action || "delegate"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Amount:</span>
            <span className="font-mono">{config?.amount || "—"} SOL</span>
          </div>
        </>
      );
    case "claim":
      return (
        <>
          <div className="flex justify-between items-center mb-1">
            <span>From:</span>
            <span className="font-mono">{config?.fromPool || "Pool"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Token:</span>
            <span className="font-mono">{config?.token || "YIELD"}</span>
          </div>
        </>
      );
    case "autoEarn":
      return (
        <>
          <div className="flex justify-between items-center mb-1">
            <span>Asset:</span>
            <span className="font-mono">{config?.asset || "SOL"}</span>
          </div>
          <div className="flex justify-between items-center mb-1">
            <span>Amount:</span>
            <span className="font-mono">{config?.amount || "1.0"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Risk:</span>
            <span className="font-mono capitalize">{config?.riskProfile || "balanced"}</span>
          </div>
        </>
      );
    case "bridge":
      return (
        <>
          <div className="flex justify-between items-center mb-1">
            <span>From:</span>
            <span className="font-mono">{config?.sourceChain || "Bitcoin"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>To:</span>
            <span className="font-mono">{config?.targetChain || "Solana"}</span>
          </div>
        </>
      );
    case "lightning":
      return (
        <>
          <div className="flex justify-between items-center mb-1">
            <span>To:</span>
            <span className="font-mono truncate max-w-[100px]">{config?.recipient ? `${config.recipient.slice(0,6)}…` : "recipient"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Amount:</span>
            <span className="font-mono">{config?.amount || "0.01"} SOL</span>
          </div>
        </>
      );
    case "orcaSwap":
    case "raydiumSwap":
      return (
        <>
          <div className="flex justify-between items-center mb-1">
            <span>From:</span>
            <span className="font-mono">{config?.sourceToken === 'CUSTOM' ? config?.sourceMint || 'CUSTOM' : config?.sourceToken || 'SOL'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>To:</span>
            <span className="font-mono">{config?.targetToken === 'CUSTOM' ? config?.targetMint || 'CUSTOM' : config?.targetToken || 'USDC'}</span>
          </div>
        </>
      );
    case "tokenCreation":
      return (
        <>
          <div className="flex justify-between items-center mb-1">
            <span>Symbol:</span>
            <span className="font-mono">{config?.symbol || "TKN"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Supply:</span>
            <span className="font-mono">{config?.initialSupply || "1000000"}</span>
          </div>
        </>
      );
    default:
      return (
        <div className="flex justify-between items-center">
          <span>Configure:</span>
          <span className="font-mono">Settings</span>
        </div>
      );
  }
};

function WorkflowNodeComponent({ data, id }: NodeProps<NodeData>) {
  const { type, label, config, executionStatus = 'idle' } = data;
  const styles = getNodeStyles(type);
  const overlay = getExecutionOverlay(executionStatus);

  return (
    <div
      className={`node rounded-lg p-2.5 w-[180px] text-white border border-dark-100 shadow-md transition-all duration-300 ${overlay.pulse ? 'animate-pulse' : ''}`}
      style={{
        backgroundColor: styles.backgroundColor,
        borderLeft: styles.borderLeft,
        boxShadow: overlay.boxShadow,
      }}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500 border-2 border-white" />

      <div className="node-header flex justify-between items-center mb-2">
        <div className="flex items-center gap-1.5">
          <span className="material-icons text-xs" style={{ color: styles.iconColor }}>
            {styles.icon}
          </span>
          <span className="text-xs font-medium">{label}</span>
        </div>
        {overlay.statusIcon ? (
          <span className="material-icons text-xs" style={{ color: overlay.statusColor }}>
            {overlay.statusIcon}
          </span>
        ) : (
          <span className="material-icons text-xs text-gray-400">more_horiz</span>
        )}
      </div>

      <div className="p-2 rounded bg-dark-300 mb-2 text-xs">
        {getNodeContent(type, config)}
      </div>

      <div className="flex justify-between text-[10px] text-gray-400">
        <span>ID: #{id.split('-').pop()}</span>
        {executionStatus !== 'idle' && (
          <span
            className="capitalize font-medium"
            style={{ color: overlay.statusColor ?? undefined }}
          >
            {executionStatus}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500 border-2 border-white" />
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeComponent);
