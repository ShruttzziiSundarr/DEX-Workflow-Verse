import React, { useState, useCallback, useRef } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Connection,
  Edge,
  Node,
  NodeTypes,
  Panel,
  getIncomers,
  getOutgoers,
  getConnectedEdges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ACTION_TEMPLATES } from './action-templates';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  AlertCircle, 
  CheckCircle, 
  PlayCircle, 
  ListChecks, 
  ChevronRight, 
  X,
  Save
} from 'lucide-react';

// Node components with connection handles
const ActionNode = ({ data }: { data: any }) => {
  const actionType = data.type || 'httpRequest';
  const label = data.label || 'Action';
  
  const getIcon = () => {
    switch (actionType) {
      case 'httpRequest': return '🌐';
      case 'smartContractCall': return '📝';
      case 'defiSwap': return '🔄';
      case 'tokenTransfer': return '💸';
      case 'emailSend': return '📧';
      default: return '⚙️';
    }
  };
  
  return (
    <div className="px-4 py-2 border-2 border-gray-300 rounded-md shadow-sm bg-white min-w-[150px] relative">
      <div className="flex items-center gap-2">
        <div className="text-2xl">{getIcon()}</div>
        <div>
          <div className="font-medium">{label}</div>
          <div className="text-xs text-gray-500">{actionType}</div>
        </div>
      </div>
      
      {/* Connection handles - visible dots that you can drag from/to */}
      <div 
        className="absolute top-1/2 left-0 w-3 h-3 bg-green-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 cursor-crosshair border border-white"
        style={{ zIndex: 1000 }}
        data-handle="target"
      />
      <div 
        className="absolute top-1/2 right-0 w-3 h-3 bg-blue-500 rounded-full transform translate-x-1/2 -translate-y-1/2 cursor-crosshair border border-white"
        style={{ zIndex: 1000 }}
        data-handle="source"
      />
    </div>
  );
};

const ConditionNode = ({ data }: { data: any }) => {
  return (
    <div className="px-4 py-2 border-2 border-gray-300 rounded-md shadow-sm bg-yellow-50 min-w-[150px] relative">
      <div className="flex items-center gap-2">
        <div className="text-2xl">⚖️</div>
        <div>
          <div className="font-medium">{data.label || 'Condition'}</div>
          <div className="text-xs text-gray-500">Branch workflow</div>
        </div>
      </div>
      
      {/* Connection handles - visible dots that you can drag from/to */}
      <div 
        className="absolute top-1/2 left-0 w-3 h-3 bg-green-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 cursor-crosshair border border-white"
        style={{ zIndex: 1000 }}
        data-handle="target"
      />
      <div 
        className="absolute top-1/2 right-0 w-3 h-3 bg-blue-500 rounded-full transform translate-x-1/2 -translate-y-1/2 cursor-crosshair border border-white"
        style={{ zIndex: 1000 }}
        data-handle="source"
      />
      <div 
        className="absolute bottom-0 right-1/2 w-3 h-3 bg-orange-500 rounded-full transform translate-x-1/2 translate-y-1/2 cursor-crosshair border border-white"
        style={{ zIndex: 1000 }}
        data-handle="source"
        data-handleid="false"
      />
    </div>
  );
};

const StartEndNode = ({ data }: { data: any }) => {
  const isStart = data.subType === 'start';
  return (
    <div className={`px-4 py-2 border-2 border-gray-300 rounded-full shadow-sm ${
      isStart ? 'bg-green-50' : 'bg-red-50'
    } min-w-[100px] flex items-center justify-center relative`}>
      <div className="text-lg font-medium">{data.label}</div>
      
      {/* Start nodes only have outputs, end nodes only have inputs */}
      {isStart && (
        <div 
          className="absolute top-1/2 right-0 w-3 h-3 bg-blue-500 rounded-full transform translate-x-1/2 -translate-y-1/2 cursor-crosshair border border-white"
          style={{ zIndex: 1000 }}
          data-handle="source"
        />
      )}
      
      {!isStart && (
        <div 
          className="absolute top-1/2 left-0 w-3 h-3 bg-green-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 cursor-crosshair border border-white"
          style={{ zIndex: 1000 }}
          data-handle="target"
        />
      )}
    </div>
  );
};

// Node type definitions
const nodeTypes: NodeTypes = {
  actionNode: ActionNode,
  conditionNode: ConditionNode,
  startEndNode: StartEndNode,
};

// Available node templates
const NODE_TEMPLATES = [
  {
    type: 'actionNode',
    label: 'HTTP Request',
    actionType: 'httpRequest',
    description: 'Make an API call',
  },
  {
    type: 'actionNode',
    label: 'Smart Contract',
    actionType: 'smartContractCall',
    description: 'Execute a contract function',
  },
  {
    type: 'actionNode',
    label: 'Token Swap',
    actionType: 'defiSwap',
    description: 'Swap between tokens',
  },
  {
    type: 'conditionNode',
    label: 'Condition',
    description: 'If/else branch',
  },
  {
    type: 'startEndNode',
    label: 'Start',
    subType: 'start',
    description: 'Workflow start',
  },
  {
    type: 'startEndNode',
    label: 'End',
    subType: 'end',
    description: 'Workflow end',
  },
];

// Generate unique IDs
const generateId = () => `${Math.random().toString(36).substr(2, 9)}`;

// Validation types
interface ValidationError {
  nodeId?: string;
  type: 'connection' | 'property' | 'general';
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ExecutionStep {
  nodeId: string;
  type: string;
  label: string;
  details: string;
}

// Main component
function SimpleVisualEditor() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [workflowName, setWorkflowName] = useState('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const [executionPreview, setExecutionPreview] = useState<ExecutionStep[]>([]);
  const [showExecutionPreview, setShowExecutionPreview] = useState(false);
  const { toast } = useToast();
  
  // Handle connections between nodes
  const onConnect = useCallback((params: Connection) => {
    const newEdge = {
      ...params,
      id: `e-${generateId()}`,
      animated: true,
      style: { strokeWidth: 2 },
    };
    setEdges((eds) => addEdge(newEdge, eds));
  }, [setEdges]);
  
  // Handle dropping nodes onto canvas
  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);
  
  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    
    const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
    if (!reactFlowBounds) return;
    
    const templateId = event.dataTransfer.getData('application/reactflow');
    if (!templateId) return;
    
    const template = NODE_TEMPLATES.find(t => `${t.type}-${t.actionType || t.subType || ''}` === templateId);
    if (!template) return;
    
    // Calculate position where node is dropped
    const position = {
      x: event.clientX - reactFlowBounds.left - 75,
      y: event.clientY - reactFlowBounds.top - 25,
    };
    
    // Create a new node
    const newNode = {
      id: generateId(),
      type: template.type,
      position,
      data: {
        label: template.label,
        type: template.actionType,
        subType: template.subType,
        config: {},
      },
    };
    
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);
  
  // Handle node selection
  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  };
  
  // Validate the workflow
  const validateWorkflow = () => {
    const errors: ValidationError[] = [];
    
    // Check if there's at least one node
    if (nodes.length === 0) {
      errors.push({
        type: 'general',
        message: 'Workflow must contain at least one node'
      });
      setValidationResult({ valid: false, errors });
      return { valid: false, errors };
    }
    
    // Find start nodes
    const startNodes = nodes.filter(node => 
      node.type === 'startEndNode' && node.data.subType === 'start'
    );
    
    if (startNodes.length === 0) {
      errors.push({
        type: 'general',
        message: 'Workflow must have a start node'
      });
    } else if (startNodes.length > 1) {
      errors.push({
        type: 'general',
        message: 'Workflow cannot have multiple start nodes'
      });
    }
    
    // Check for connectivity from start node
    if (startNodes.length === 1) {
      const startNode = startNodes[0];
      const outgoers = getOutgoers(startNode, nodes, edges);
      if (outgoers.length === 0) {
        errors.push({
          nodeId: startNode.id,
          type: 'connection',
          message: 'Start node must connect to at least one other node'
        });
      }
    }
    
    // Check action nodes for required properties
    nodes.forEach(node => {
      if (node.type === 'actionNode') {
        const actionType = node.data.type;
        if (actionType) {
          const template = ACTION_TEMPLATES.find(t => t.id === actionType);
          if (template && template.parameterSchema) {
            // Handle any parameter schema checking in a safer way
            try {
              Object.entries(template.parameterSchema || {}).forEach(([key, schema]: [string, any]) => {
                if (schema && schema.required && 
                    (!node.data.config || 
                     !node.data.config[key] || 
                     node.data.config[key] === '')) {
                  errors.push({
                    nodeId: node.id,
                    type: 'property',
                    message: `Missing required field: ${schema.label || key} for node "${node.data.label}"`
                  });
                }
              });
            } catch (err) {
              console.error('Error checking node properties:', err);
            }
          }
        }
        
        // Check for incoming connections (except for nodes directly after start)
        const incomers = getIncomers(node, nodes, edges);
        const startNodesArray = nodes.filter(n => n.type === 'startEndNode' && n.data.subType === 'start');
        
        if (incomers.length === 0 && startNodesArray.length > 0) {
          // If there's no incoming connection and it's not directly after start
          const directlyAfterStart = edges.some(
            edge => 
              edge.target === node.id && 
              startNodesArray.some(sNode => edge.source === sNode.id)
          );
          
          if (!directlyAfterStart) {
            errors.push({
              nodeId: node.id,
              type: 'connection',
              message: `Node "${node.data.label}" is not connected to any previous node`
            });
          }
        }
      }
    });
    
    const result = { valid: errors.length === 0, errors };
    setValidationResult(result);
    setShowValidationDetails(errors.length > 0);
    
    if (errors.length === 0) {
      toast({
        title: 'Validation Successful',
        description: 'Your workflow is properly configured.',
      });
    } else {
      toast({
        title: 'Validation Failed',
        description: `${errors.length} issue${errors.length > 1 ? 's' : ''} found. See details below.`,
        variant: 'destructive',
      });
    }
    
    return result;
  };
  
  // Generate execution preview
  const generateExecutionPreview = () => {
    const steps: ExecutionStep[] = [];
    const visited = new Set<string>();
    
    // Find start node
    const startNode = nodes.find(n => n.type === 'startEndNode' && n.data.subType === 'start');
    if (!startNode) {
      toast({
        title: 'Error',
        description: 'Cannot generate preview - workflow must have a start node',
        variant: 'destructive',
      });
      return;
    }
    
    // BFS traversal function
    const traverseWorkflow = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      
      if (node.type === 'actionNode') {
        const actionType = node.data.type;
        const actionTemplate = ACTION_TEMPLATES.find(t => t.id === actionType);
        
        let details = '';
        if (node.data.config && actionTemplate) {
          // Format configuration details
          details = Object.entries(node.data.config)
            .filter(([key, value]) => value !== undefined && value !== '')
            .map(([key, value]) => {
              // parameterSchema can be a union type; safely treat it as a map for runtime lookup
              let paramSchema: any = null;
              if (actionTemplate?.parameterSchema && typeof actionTemplate.parameterSchema === 'object') {
                const schemaMap = actionTemplate.parameterSchema as Record<string, any>;
                if (Object.prototype.hasOwnProperty.call(schemaMap, key)) {
                  paramSchema = schemaMap[key];
                }
              }
              const label = paramSchema?.label || key;
              return `${label}: ${value}`;
            })
            .join(', ');
        }
        
        steps.push({
          nodeId: node.id,
          type: actionType || 'unknown',
          label: node.data.label,
          details: details || 'No configuration'
        });
      } else if (node.type === 'conditionNode') {
        steps.push({
          nodeId: node.id,
          type: 'condition',
          label: node.data.label,
          details: node.data.condition || 'No condition specified'
        });
      } else if (node.type === 'startEndNode' && node.data.subType === 'end') {
        steps.push({
          nodeId: node.id,
          type: 'end',
          label: node.data.label,
          details: 'Workflow completes'
        });
      }
      
      // Find outgoing connections and follow them
      const outgoingEdges = edges.filter(e => e.source === nodeId);
      outgoingEdges.forEach(edge => {
        traverseWorkflow(edge.target);
      });
    };
    
    // Start traversal from the start node
    traverseWorkflow(startNode.id);
    
    setExecutionPreview(steps);
    setShowExecutionPreview(true);
    
    if (steps.length === 0) {
      toast({
        title: 'Warning',
        description: 'No executable actions found in the workflow.',
        variant: 'destructive',
      });
    }
  };
  
  // Save workflow
  const saveWorkflow = async () => {
    if (!workflowName) {
      toast({
        title: 'Error',
        description: 'Please provide a workflow name',
        variant: 'destructive',
      });
      return;
    }
    
    // Validate before saving
    const validationResult = validateWorkflow();
    if (!validationResult.valid) {
      return;
    }
    
    try {
      // Create workflow data structure
      const workflowData = {
        name: workflowName,
        description: 'Created with Visual Builder',
        nodes: nodes,
        edges: edges,
      };
      
      // Save to backend
      const response = await apiRequest('POST', '/api/workflows', workflowData);
      const workflow = await response.json();
      
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
  };
  
  return (
    <div className="flex h-full">
      {/* Sidebar with node templates */}
      <div className="w-64 bg-gray-100 p-4 overflow-y-auto border-r flex flex-col">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Workflow Name</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-md"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            placeholder="My Workflow"
          />
        </div>
        
        <h3 className="font-medium mb-3">Node Templates</h3>
        <div className="space-y-2 flex-grow overflow-y-auto">
          {NODE_TEMPLATES.map((template) => (
            <div
              key={`${template.type}-${template.actionType || template.subType || ''}`}
              className="p-2 bg-white rounded-md shadow-sm cursor-move border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  'application/reactflow',
                  `${template.type}-${template.actionType || template.subType || ''}`
                );
                event.dataTransfer.effectAllowed = 'move';
              }}
            >
              <div className="font-medium">{template.label}</div>
              <div className="text-xs text-gray-500">{template.description}</div>
            </div>
          ))}
        </div>
        
        <div className="mt-auto pt-4 border-t space-y-2">
          <button
            onClick={validateWorkflow}
            className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            <ListChecks className="h-4 w-4" />
            Validate Workflow
          </button>
          
          <button
            onClick={generateExecutionPreview}
            className="w-full py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
          >
            <PlayCircle className="h-4 w-4" />
            Preview Execution
          </button>
          
          <button
            onClick={saveWorkflow}
            className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save Workflow
          </button>
        </div>
      </div>
      
      {/* Flow canvas */}
  <div className="flex-grow h-[calc(100vh-2rem)] relative" ref={reactFlowWrapper} style={{ width: '100%', height: 'calc(100vh - 2rem)' }}>
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
            <div className="bg-white p-2 rounded-md shadow-md text-sm space-y-2">
              <div>
                Drag elements from the sidebar onto the canvas
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const validated = validateWorkflow();
                    if (validated.valid) {
                      generateExecutionPreview();
                    }
                  }}
                  className="px-3 py-1 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700 flex items-center gap-1"
                >
                  <ListChecks className="w-4 h-4" />
                  Validate
                </button>
                <button
                  onClick={saveWorkflow}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center gap-1"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
          </Panel>
        </ReactFlow>

        {/* Fixed action bar (always visible) */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-50">
          <div className="flex space-x-3 bg-white p-2 rounded-lg shadow-lg">
            <button
              onClick={validateWorkflow}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center gap-2 transition-colors"
            >
              <ListChecks className="h-4 w-4" />
              Validate
            </button>
            <button
              onClick={generateExecutionPreview}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md flex items-center gap-2 transition-colors"
            >
              <PlayCircle className="h-4 w-4" />
              Execute
            </button>
            <button
              onClick={saveWorkflow}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2 transition-colors"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          </div>
        </div>
      </div>
      
      {/* Node editor panel (conditionally rendered when a node is selected) */}
      {selectedNode && (
        <div className="w-80 bg-white p-4 border-l overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Edit Node</h3>
            <button
              className="text-gray-500 hover:text-gray-800"
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
                onChange={(e) => {
                  // Update node label
                  setNodes((nds) =>
                    nds.map((node) => {
                      if (node.id === selectedNode.id) {
                        return {
                          ...node,
                          data: {
                            ...node.data,
                            label: e.target.value,
                          },
                        };
                      }
                      return node;
                    })
                  );
                  setSelectedNode({
                    ...selectedNode,
                    data: { ...selectedNode.data, label: e.target.value },
                  });
                }}
              />
            </div>
            
            {selectedNode.type === 'actionNode' && selectedNode.data.type && (
              <div>
                <label className="block text-sm font-medium mb-1">Action Type</label>
                <div className="text-sm px-3 py-2 bg-gray-100 rounded-md">
                  {selectedNode.data.type}
                </div>
              </div>
            )}
            
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
      )}

      {/* Validation Results Modal */}
      {showValidationDetails && validationResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium flex items-center">
                {validationResult.valid ? (
                  <>
                    <CheckCircle className="text-green-500 mr-2 h-5 w-5" />
                    Validation Successful
                  </>
                ) : (
                  <>
                    <AlertCircle className="text-red-500 mr-2 h-5 w-5" />
                    Validation Failed
                  </>
                )}
              </h3>
              <button 
                onClick={() => setShowValidationDetails(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {validationResult.valid ? (
              <p className="text-green-600">Your workflow is valid and ready to be saved or executed.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-red-600 mb-2">
                  Found {validationResult.errors.length} issue{validationResult.errors.length > 1 ? 's' : ''} in your workflow:
                </p>
                <ul className="space-y-2">
                  {validationResult.errors.map((error, index) => (
                    <li key={index} className="border-l-4 border-red-500 pl-3 py-2 bg-red-50">
                      <div className="flex items-start">
                        <AlertCircle className="text-red-500 mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">
                            {error.type === 'connection' ? 'Connection Issue' : 
                             error.type === 'property' ? 'Missing Property' : 
                             'General Issue'}
                          </div>
                          <div className="text-sm text-gray-700">{error.message}</div>
                          {error.nodeId && (
                            <div className="text-xs text-gray-500 mt-1">
                              Node ID: {error.nodeId}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-gray-600 mt-4">
                  Please fix these issues before saving or executing your workflow.
                </p>
              </div>
            )}
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowValidationDetails(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Execution Preview Modal */}
      {showExecutionPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium flex items-center">
                <PlayCircle className="text-purple-500 mr-2 h-5 w-5" />
                Execution Preview
              </h3>
              <button 
                onClick={() => setShowExecutionPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {executionPreview.length === 0 ? (
              <p className="text-gray-600">No executable steps found in your workflow.</p>
            ) : (
              <div className="space-y-1">
                <p className="text-gray-600 mb-4">
                  Your workflow will execute the following {executionPreview.length} step{executionPreview.length > 1 ? 's' : ''} in order:
                </p>
                <ol className="relative border-l-2 border-gray-300">
                  {executionPreview.map((step, index) => {
                    // Determine icon based on step type
                    let icon;
                    let bgColor;
                    
                    switch (step.type) {
                      case 'httpRequest':
                        icon = '🌐';
                        bgColor = 'bg-blue-100';
                        break;
                      case 'smartContractCall':
                        icon = '📝';
                        bgColor = 'bg-indigo-100';
                        break;
                      case 'defiSwap':
                        icon = '🔄';
                        bgColor = 'bg-green-100';
                        break;
                      case 'tokenTransfer':
                        icon = '💸';
                        bgColor = 'bg-yellow-100';
                        break;
                      case 'emailSend':
                        icon = '📧';
                        bgColor = 'bg-pink-100';
                        break;
                      case 'condition':
                        icon = '⚖️';
                        bgColor = 'bg-amber-100';
                        break;
                      case 'end':
                        icon = '🏁';
                        bgColor = 'bg-red-100';
                        break;
                      default:
                        icon = '⚙️';
                        bgColor = 'bg-gray-100';
                    }
                    
                    return (
                      <li key={step.nodeId} className="mb-6 ml-6">
                        <span className={`absolute flex items-center justify-center w-8 h-8 rounded-full -left-4 ${bgColor} text-lg`}>
                          {icon}
                        </span>
                        <div className="ml-2">
                          <h3 className="flex items-center text-lg font-semibold">
                            {index + 1}. {step.label}
                            <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded bg-gray-200">
                              {step.type}
                            </span>
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">{step.details}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
            
            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => setShowExecutionPreview(false)}
                className="px-4 py-2 border border-gray-300 rounded-md"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const validated = validateWorkflow();
                  if (validated.valid) {
                    toast({
                      title: 'Ready to Execute',
                      description: 'Your workflow is valid and ready to run.',
                    });
                  }
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-md"
              >
                Validate & Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export with ReactFlowProvider
export default function SimpleVisualEditorWrapper() {
  return (
    <ReactFlowProvider>
      <div className="h-full border rounded-md overflow-hidden">
        <SimpleVisualEditor />
      </div>
    </ReactFlowProvider>
  );
}