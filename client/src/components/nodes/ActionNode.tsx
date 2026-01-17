import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

// Icons based on action type
const actionIcons: Record<string, string> = {
  httpRequest: '🌐',
  smartContractCall: '📝',
  defiSwap: '🔄',
  addLiquidity: '💧',
  tokenTransfer: '💸',
  emailSend: '📧',
};

function ActionNode({ data, isConnectable, selected }: NodeProps) {
  const actionType = data.actionType || 'httpRequest';
  const icon = actionIcons[actionType] || '⚙️';
  
  return (
    <div className={`px-4 py-2 rounded-md border-2 ${
      selected ? 'border-blue-500 shadow-md' : 'border-gray-300'
    } bg-white min-w-[180px]`}>
      {/* Input handle at the top */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-blue-500"
      />
      
      {/* Node content */}
      <div className="flex items-center gap-2">
        <div className="text-xl">{icon}</div>
        <div className="flex-1">
          <div className="font-semibold text-gray-800">{data.label}</div>
          <div className="text-xs text-gray-500">
            {Object.entries(data.config || {})
              .filter(([_, value]) => value !== '' && value !== undefined)
              .slice(0, 2) // Show only first 2 config items
              .map(([key, value]) => (
                <div key={key} className="truncate">
                  {key}: {typeof value === 'string' ? value : JSON.stringify(value)}
                </div>
              ))}
            {Object.keys(data.config || {}).length > 2 && (
              <div>+ {Object.keys(data.config || {}).length - 2} more</div>
            )}
          </div>
        </div>
      </div>
      
      {/* Output handle at the bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-blue-500"
      />
    </div>
  );
}

export default memo(ActionNode);