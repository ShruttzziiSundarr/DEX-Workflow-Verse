import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { ModuleType } from "@shared/schema";

interface NodeData {
  type: ModuleType;
  label: string;
  config?: any;
}

const getNodeStyles = (type: ModuleType) => {
  switch (type) {
    case "swap":
      return {
        backgroundColor: "rgba(49, 101, 245, 0.2)",
        borderLeft: "4px solid #3165F5",
        icon: "swap_horiz",
        iconColor: "#3165F5",
      };
    case "addLiquidity":
      return {
        backgroundColor: "rgba(6, 182, 212, 0.2)",
        borderLeft: "4px solid #06B6D4",
        icon: "water_drop",
        iconColor: "#06B6D4",
      };
    case "stake":
      return {
        backgroundColor: "rgba(16, 185, 129, 0.2)",
        borderLeft: "4px solid #10B981",
        icon: "lock",
        iconColor: "#10B981",
      };
    case "claim":
      return {
        backgroundColor: "rgba(124, 58, 237, 0.2)",
        borderLeft: "4px solid #7C3AED",
        icon: "redeem",
        iconColor: "#7C3AED",
      };
    case "bridge":
      return {
        backgroundColor: "rgba(245, 158, 11, 0.2)",
        borderLeft: "4px solid #F59E0B",
        icon: "bridge",
        iconColor: "#F59E0B",
      };
    case "lightning":
      return {
        backgroundColor: "rgba(245, 158, 11, 0.2)",
        borderLeft: "4px solid #F59E0B",
        icon: "bolt",
        iconColor: "#F59E0B",
      };
    default:
      return {
        backgroundColor: "rgba(75, 85, 99, 0.2)",
        borderLeft: "4px solid #4B5563",
        icon: "settings",
        iconColor: "#4B5563",
      };
  }
};

const getNodeContent = (type: ModuleType, config: any) => {
  switch (type) {
    case "swap":
      return (
        <>
          <div className="flex justify-between items-center mb-1">
            <span>From:</span>
            <span className="font-mono">{config?.sourceToken || "BTC"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>To:</span>
            <span className="font-mono">{config?.targetToken || "sBTC"}</span>
          </div>
        </>
      );
    case "addLiquidity":
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
    case "stake":
      return (
        <>
          <div className="flex justify-between items-center mb-1">
            <span>Asset:</span>
            <span className="font-mono">{config?.asset || "sBTC"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Pool:</span>
            <span className="font-mono">{config?.pool || "Yield Farm"}</span>
          </div>
        </>
      );
    case "claim":
      return (
        <>
          <div className="flex justify-between items-center mb-1">
            <span>From:</span>
            <span className="font-mono">{config?.fromPool || "Yield Farm"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Token:</span>
            <span className="font-mono">{config?.token || "YIELD"}</span>
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
            <span className="font-mono">{config?.targetChain || "sBTC Network"}</span>
          </div>
        </>
      );
    case "lightning":
      return (
        <>
          <div className="flex justify-between items-center mb-1">
            <span>To:</span>
            <span className="font-mono truncate max-w-[100px]">{config?.recipient || "recipient"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Amount:</span>
            <span className="font-mono">{config?.amount || "0.01"} BTC</span>
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
  const { type, label, config } = data;
  const styles = getNodeStyles(type);
  
  return (
    <div
      className="node rounded-lg p-2.5 w-[180px] text-white border border-dark-100 shadow-md"
      style={{ 
        backgroundColor: styles.backgroundColor,
        borderLeft: styles.borderLeft
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
      
      <div className="node-header flex justify-between items-center mb-2">
        <div className="flex items-center gap-1.5">
          <span className="material-icons text-xs" style={{ color: styles.iconColor }}>
            {styles.icon}
          </span>
          <span className="text-xs font-medium">{label}</span>
        </div>
        <span className="material-icons text-xs text-gray-400">more_horiz</span>
      </div>
      
      <div className="p-2 rounded bg-dark-300 mb-2 text-xs">
        {getNodeContent(type, config)}
      </div>
      
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>ID: #{id.split('-')[1] || id}</span>
        <span>Config ›</span>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeComponent);
