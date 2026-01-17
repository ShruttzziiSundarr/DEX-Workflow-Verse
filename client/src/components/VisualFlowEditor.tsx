import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  Panel,
  MarkerType,
  useReactFlow,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ACTION_TEMPLATES } from './action-templates';
import { TokenSelector } from './TokenSelector';
import { getTokenByAddress } from '../lib/solana/tokenList';
// Using built-in Node ID generator
import { Trash2, Save, Play, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// Custom node components
import ActionNode from './nodes/ActionNode';
import ConditionNode from './nodes/ConditionNode';
import StartEndNode from './nodes/StartEndNode';

// Function to generate unique IDs
const generateId = () => `${Math.random().toString(36).substr(2, 9)}`;

// Defining node types for the flow editor
const nodeTypes: NodeTypes = {
  actionNode: ActionNode,
  conditionNode: ConditionNode,
  startEndNode: StartEndNode,
};

// Define templates that can be dragged onto the canvas
export const NODE_TEMPLATES = [
  {
    type: 'actionNode',
    label: 'HTTP Request',
    actionType: 'httpRequest',
    description: 'Make an API call to an external service',
    category: 'api',
  },
  {
    type: 'actionNode',
    label: 'Smart Contract',
    actionType: 'smartContractCall',
    description: 'Call a smart contract function',
    category: 'blockchain',
  },
  {
    type: 'actionNode',
    label: 'Token Swap',
    actionType: 'defiSwap',
    description: 'Swap one token for another',
    category: 'defi',
  },
  {
    type: 'actionNode',
    label: 'Token Transfer',
    actionType: 'tokenTransfer',
    description: 'Transfer tokens to a wallet',
    category: 'payments',
  },
  {
    type: 'actionNode',
    label: 'Email Notification',
    actionType: 'emailSend',
    description: 'Send an email notification',
    category: 'notifications',
  },
  {
    type: 'conditionNode',
    label: 'Condition',
    description: 'Branch the flow based on a condition',
    category: 'logic',
  },
  {
    type: 'startEndNode',
    label: 'Start',
    subType: 'start',
    description: 'Starting point of the workflow',
    category: 'flow',
  },
  {
    type: 'startEndNode',
    label: 'End',
    subType: 'end',
    description: 'Ending point of the workflow',
    category: 'flow',
  },
];

// Function to create a new node from a template
export const createNodeFromTemplate = (template: any, position: { x: number, y: number }) => {
  const id = generateId();
  
  // Find the corresponding action template if it's an action node
  let config = {};
  if (template.type === 'actionNode' && template.actionType) {
    const actionTemplate = ACTION_TEMPLATES.find((t: any) => t.id === template.actionType);
    if (actionTemplate) {
      config = { ...actionTemplate.defaultConfig };
    }
  }
  
  const newNode: Node = {
    id,
    type: template.type,
    position,
    data: {
      label: template.label,
      description: template.description,
      actionType: template.actionType,
      subType: template.subType,
      config,
    },
  };
  
  return newNode;
};

// Main VisualFlowEditor component with drag-and-drop
const VisualFlowEditor = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const { toast } = useToast();
  
  const reactFlow = useReactFlow();
  
  // Handle edge connections
  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge = {
        ...connection,
        id: `e-${generateId()}`,
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#3b82f6',
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges],
  );
  
  // Handle node selection
  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  };
  
  // Handle dropping a template onto the canvas
  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      
      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowBounds) return;
      
      const templateId = event.dataTransfer.getData('application/reactflow');
      
      // Check if the dropped element is a valid template
      if (!templateId) {
        return;
      }
      
      const template = NODE_TEMPLATES.find(t => t.type + '-' + (t.actionType || t.subType || '') === templateId);
      if (!template) return;
      
      const position = reactFlow.screenToFlowPosition({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });
      
      const newNode = createNodeFromTemplate(template, position);
      
      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlow, setNodes],
  );
  
  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);
  
  // Handle node data updates (via props from the NodeDetail component)
  const updateNodeData = useCallback(
    (nodeId: string, newData: any) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ...newData,
              },
            };
          }
          return node;
        })
      );
      
      if (selectedNode?.id === nodeId) {
        setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, ...newData } } : null);
      }
    },
    [setNodes, selectedNode]
  );
  
  // Clear the canvas
  const clearFlow = useCallback(() => {
    if (confirm('Are you sure you want to clear the workflow? This cannot be undone.')) {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
    }
  }, [setNodes, setEdges]);
  
  // Save the workflow to the backend
  const saveWorkflow = useCallback(async () => {
    if (!workflowName) {
      toast({
        title: 'Workflow name required',
        description: 'Please provide a name for your workflow',
        variant: 'destructive',
      });
      return;
    }
    
    // Validate workflow structure
    const startNodes = nodes.filter(node => 
      node.type === 'startEndNode' && node.data.subType === 'start'
    );
    
    if (startNodes.length === 0) {
      toast({
        title: 'Missing start node',
        description: 'Your workflow must have a start node',
        variant: 'destructive',
      });
      return;
    }
    
    if (startNodes.length > 1) {
      toast({
        title: 'Multiple start nodes',
        description: 'Your workflow cannot have more than one start node',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // Extract executable actions from the workflow
      const actions = nodes
        .filter(node => node.type === 'actionNode')
        .map((node, index) => ({
          name: node.data.label,
          type: node.data.actionType,
          config: node.data.config || {},
          order: index, // We should ideally derive order from the graph, but for simplicity using index
        }));
      
      if (actions.length === 0) {
        toast({
          title: 'No actions found',
          description: 'Your workflow must have at least one action',
          variant: 'destructive',
        });
        return;
      }
      
      // Create the workflow with the visual representation
      const workflowData = {
        name: workflowName,
        description: workflowDescription,
        nodes: nodes.map(({ id, type, position, data }) => ({
          id,
          type,
          position,
          data: {
            label: data.label,
            type: data.actionType,
            subType: data.subType,
            config: data.config,
          }
        })),
        edges: edges.map(({ id, source, target, sourceHandle, targetHandle }) => ({
          id, 
          source, 
          target,
          sourceHandle,
          targetHandle,
        })),
      };
      
      const response = await apiRequest('POST', '/api/workflows', workflowData);
      const workflow = await response.json();
      
      // Add each action to the workflow
      for (const action of actions) {
        await apiRequest('POST', `/api/workflows/${workflow.id}/actions`, action);
      }
      
      toast({
        title: 'Success',
        description: 'Workflow saved successfully!',
      });
      
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast({
        title: 'Error',
        description: 'Failed to save workflow. Please try again.',
        variant: 'destructive',
      });
    }
  }, [nodes, edges, workflowName, workflowDescription, toast]);
  
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-4 bg-slate-100 p-3 rounded-md">
        <div className="grid grid-cols-2 gap-4 flex-grow mr-4">
          <div>
            <label htmlFor="workflow-name" className="block text-sm font-medium mb-1">
              Workflow Name
            </label>
            <input
              id="workflow-name"
              type="text"
              className="w-full px-3 py-2 border rounded-md"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Enter workflow name"
            />
          </div>
          <div>
            <label htmlFor="workflow-description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <input
              id="workflow-description"
              type="text"
              className="w-full px-3 py-2 border rounded-md"
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
              placeholder="Describe this workflow"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={saveWorkflow}
            className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center"
          >
            <Save className="mr-2 h-4 w-4" />
            Save Workflow
          </button>
          <button 
            onClick={clearFlow}
            className="px-4 py-2 bg-gray-600 text-white rounded-md flex items-center"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </button>
        </div>
      </div>
      
      <div className="flex flex-1 h-[500px] border rounded-md overflow-hidden">
        {/* Sidebar with node templates */}
        <div className="w-64 bg-gray-100 p-4 overflow-y-auto border-r">
          <h3 className="font-medium text-lg mb-3">Flow Elements</h3>
          <div className="space-y-3">
            {Object.entries(
              NODE_TEMPLATES.reduce<Record<string, typeof NODE_TEMPLATES>>((acc, template) => {
                if (!acc[template.category]) {
                  acc[template.category] = [];
                }
                acc[template.category].push(template);
                return acc;
              }, {})
            ).map(([category, templates]) => (
              <div key={category} className="mb-3">
                <h4 className="text-sm uppercase tracking-wider text-gray-500 mb-2">
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </h4>
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.type + '-' + (template.actionType || template.subType || '')}
                      className="p-2 bg-white rounded-md shadow-sm cursor-move border border-gray-200 hover:border-blue-400 transition-colors"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData(
                          'application/reactflow',
                          template.type + '-' + (template.actionType || template.subType || '')
                        );
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                    >
                      <div className="font-medium">{template.label}</div>
                      <div className="text-xs text-gray-500">{template.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Flow canvas */}
        <div className="flex-1 h-full" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls />
            <MiniMap />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            
            <Panel position="top-right">
              <div className="bg-white p-2 rounded-md shadow-md">
                <div className="text-sm text-gray-500 mb-1">Drag elements onto the canvas</div>
                <div className="text-xs text-gray-400">Connect nodes by dragging from one handle to another</div>
              </div>
            </Panel>
          </ReactFlow>
        </div>
        
        {/* Node details panel (when a node is selected) */}
        {selectedNode && (
          <div className="w-80 bg-white p-4 border-l overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Node Details</h3>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setSelectedNode(null)}
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Label</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md"
                  value={selectedNode.data.label}
                  onChange={(e) =>
                    updateNodeData(selectedNode.id, { label: e.target.value })
                  }
                />
              </div>
              
              {selectedNode.type === 'actionNode' && selectedNode.data.actionType && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Action Type</label>
                    <div className="text-sm bg-gray-100 px-3 py-2 rounded">
                      {selectedNode.data.actionType}
                    </div>
                  </div>
                  
                  {/* Render configuration fields based on action type */}
                  {renderConfigFields(selectedNode, updateNodeData)}
                </div>
              )}
              
              {selectedNode.type === 'conditionNode' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Condition</label>
                  <textarea
                    className="w-full px-3 py-2 border rounded-md h-24"
                    value={selectedNode.data.condition || ''}
                    onChange={(e) =>
                      updateNodeData(selectedNode.id, { condition: e.target.value })
                    }
                    placeholder="Enter condition expression..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Example: result.status === 'success'
                  </p>
                </div>
              )}
              
              <div className="pt-4 border-t">
                <button
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md"
                  onClick={() => {
                    setNodes(nodes.filter((n) => n.id !== selectedNode.id));
                    setEdges(edges.filter(
                      (e) => e.source !== selectedNode.id && e.target !== selectedNode.id
                    ));
                    setSelectedNode(null);
                  }}
                >
                  Delete Node
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to render configuration fields for action nodes
function renderConfigFields(node: Node, updateNodeData: (id: string, data: any) => void) {
  const actionType = node.data.actionType;
  const config = node.data.config || {};
  
  // Find the corresponding action template
  const template = ACTION_TEMPLATES.find(t => t.id === actionType);
  if (!template) return null;
  
  return (
    <div>
      <h4 className="font-medium text-sm mb-2">Configuration</h4>
      <div className="space-y-3">
        {Object.entries(template.parameterSchema).map(([key, paramDef]: [string, any]) => {
          switch (paramDef.type) {
            case "text":
              return (
                <div key={key}>
                  <label className="block text-sm font-medium mb-1">
                    {paramDef.label}{paramDef.required && " *"}
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    value={config[key] || ""}
                    onChange={(e) => {
                      const newConfig = { ...config, [key]: e.target.value };
                      updateNodeData(node.id, { config: newConfig });
                    }}
                    placeholder={paramDef.placeholder}
                  />
                  {paramDef.description && (
                    <p className="text-xs text-gray-500 mt-1">{paramDef.description}</p>
                  )}
                </div>
              );
              
            case "textarea":
              return (
                <div key={key}>
                  <label className="block text-sm font-medium mb-1">
                    {paramDef.label}{paramDef.required && " *"}
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border rounded-md text-sm min-h-[80px]"
                    value={config[key] || ""}
                    onChange={(e) => {
                      const newConfig = { ...config, [key]: e.target.value };
                      updateNodeData(node.id, { config: newConfig });
                    }}
                    placeholder={paramDef.placeholder}
                  />
                  {paramDef.description && (
                    <p className="text-xs text-gray-500 mt-1">{paramDef.description}</p>
                  )}
                </div>
              );
              
            case "select":
              return (
                <div key={key}>
                  <label className="block text-sm font-medium mb-1">
                    {paramDef.label}{paramDef.required && " *"}
                  </label>
                  <select
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    value={config[key] || paramDef.defaultValue || ""}
                    onChange={(e) => {
                      const newConfig = { ...config, [key]: e.target.value };
                      updateNodeData(node.id, { config: newConfig });
                    }}
                  >
                    <option value="" disabled>Select {paramDef.label.toLowerCase()}</option>
                    {paramDef.options.map((option: string) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  {paramDef.description && (
                    <p className="text-xs text-gray-500 mt-1">{paramDef.description}</p>
                  )}
                </div>
              );
              
            case "switch":
              return (
                <div key={key} className="flex items-center justify-between py-2">
                  <div>
                    <label className="block text-sm font-medium">
                      {paramDef.label}
                    </label>
                    {paramDef.description && (
                      <p className="text-xs text-gray-500">{paramDef.description}</p>
                    )}
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={!!config[key]}
                      onChange={(e) => {
                        const newConfig = { ...config, [key]: e.target.checked };
                        updateNodeData(node.id, { config: newConfig });
                      }}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              );
              
            case "tokenSelector":
              return (
                <div key={key}>
                  <label className="block text-sm font-medium mb-1">
                    {paramDef.label}{paramDef.required && " *"}
                  </label>
                  <TokenSelector
                    selectedToken={config[key] ? getTokenByAddress(config[key]) : undefined}
                    onTokenSelect={(token) => {
                      const newConfig = { ...config, [key]: token.address };
                      updateNodeData(node.id, { config: newConfig });
                    }}
                    placeholder={`Select ${paramDef.label.toLowerCase()}`}
                  />
                  {paramDef.description && (
                    <p className="text-xs text-gray-500 mt-1">{paramDef.description}</p>
                  )}
                </div>
              );
              
            default:
              return (
                <div key={key} className="py-2">
                  <p className="text-sm text-gray-500">
                    Unknown parameter type: {paramDef.type}
                  </p>
                </div>
              );
          }
        })}
      </div>
    </div>
  );
}

// Export with ReactFlowProvider to ensure context is available
export default function VisualFlowEditorWrapper() {
  return (
    <ReactFlowProvider>
      <VisualFlowEditor />
    </ReactFlowProvider>
  );
}