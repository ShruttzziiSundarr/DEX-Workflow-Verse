import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

function ConditionNode({ data, isConnectable, selected }: NodeProps) {
  return (
    <div className={`px-4 py-2 rounded-md border-2 ${
      selected ? 'border-blue-500 shadow-md' : 'border-gray-300'
    } bg-yellow-50 min-w-[180px]`}>
      {/* Input handle at the top */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-blue-500"
      />
      
      {/* Node content */}
      <div className="flex items-center gap-2">
        <div className="text-xl">⚖️</div>
        <div className="flex-1">
          <div className="font-semibold text-gray-800">{data.label}</div>
          <div className="text-xs text-gray-500 truncate">
            {data.condition ? data.condition : 'Click to edit condition'}
          </div>
        </div>
      </div>
      
      {/* Output handles for true/false paths */}
      <div className="mt-2 flex justify-between text-xs text-gray-500">
        <div>TRUE</div>
        <div>FALSE</div>
      </div>
      
      {/* True output (left) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ left: '25%' }}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-green-500"
      />
      
      {/* False output (right) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ left: '75%' }}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-red-500"
      />
    </div>
  );
}

export default memo(ConditionNode);