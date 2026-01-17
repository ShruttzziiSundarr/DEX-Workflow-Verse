import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

function StartEndNode({ data, isConnectable, selected }: NodeProps) {
  const isStart = data.subType === 'start';
  
  return (
    <div className={`px-4 py-2 rounded-full border-2 ${
      selected ? 'border-blue-500 shadow-md' : 'border-gray-300'
    } ${isStart ? 'bg-green-50' : 'bg-red-50'} min-w-[120px] text-center`}>
      {/* Only show input handle for end nodes */}
      {!isStart && (
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={isConnectable}
          className="w-3 h-3 bg-blue-500"
        />
      )}
      
      {/* Node content */}
      <div className="flex items-center justify-center gap-2">
        <div className="text-xl">{isStart ? '🏁' : '🛑'}</div>
        <div className="font-semibold text-gray-800">{data.label}</div>
      </div>
      
      {/* Only show output handle for start nodes */}
      {isStart && (
        <Handle
          type="source"
          position={Position.Bottom}
          isConnectable={isConnectable}
          className="w-3 h-3 bg-blue-500"
        />
      )}
    </div>
  );
}

export default memo(StartEndNode);