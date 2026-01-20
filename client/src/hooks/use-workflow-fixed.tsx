import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Node, Edge } from 'reactflow';
import { useToast } from '@/hooks/use-toast';
import { workflowService } from '@/lib/workflow-service';

interface WorkflowContextType {
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
  setSelectedNode: (node: Node | null) => void;
  saveWorkflow: () => Promise<boolean>;
  loadWorkflow: (id: number) => Promise<boolean>;
  clearWorkflow: () => void;
  updateNodeData: (nodeId: string, newData: any) => void;
  validateWorkflow: () => { valid: boolean; message: string };
  executeWorkflow: () => Promise<boolean>;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

interface WorkflowProviderProps {
  children: ReactNode;
}

export function WorkflowProvider({ children }: WorkflowProviderProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const { toast } = useToast();

  const updateNodeData = useCallback((nodeId: string, newData: any) => {
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
  }, []);

  const clearWorkflow = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
  }, []);

  const saveWorkflow = useCallback(async () => {
    try {
      const name = prompt('Enter a name for your workflow:');
      if (!name) return false;

      const success = await workflowService.saveWorkflow({
        name,
        nodes,
        edges,
      });

      if (success) {
        toast({
          title: 'Workflow Saved',
          description: `Workflow "${name}" has been saved successfully.`,
        });
      }
      return success;
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast({
        title: 'Error Saving Workflow',
        description: 'An error occurred while saving your workflow.',
        variant: 'destructive',
      });
      return false;
    }
  }, [nodes, edges, toast]);

  const loadWorkflow = useCallback(
    async (id: number) => {
      try {
        const workflow = await workflowService.loadWorkflow(id);
        if (workflow) {
          setNodes(workflow.nodes);
          setEdges(workflow.edges);
          toast({
            title: 'Workflow Loaded',
            description: `Workflow "${workflow.name}" has been loaded.`,
          });
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error loading workflow:', error);
        toast({
          title: 'Error Loading Workflow',
          description: 'An error occurred while loading the workflow.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast]
  );

  const validateWorkflow = useCallback(() => {
    // Basic validation
    if (nodes.length === 0) {
      return { valid: false, message: 'Workflow is empty. Add some modules to continue.' };
    }

    // Check for disconnected nodes
    const connectedNodeIds = new Set<string>();
    
    edges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });
    
    // If there's only one node, it doesn't need connections
    if (nodes.length > 1) {
      const disconnectedNodes = nodes.filter(node => !connectedNodeIds.has(node.id));
      
      if (disconnectedNodes.length > 0) {
        return { 
          valid: false, 
          message: `There are ${disconnectedNodes.length} disconnected modules. Connect all modules to create a valid workflow.` 
        };
      }
    }

    // Check for cycles (simplified)
    // A proper cycle detection would use a graph traversal algorithm

    return { valid: true, message: 'Workflow is valid' };
  }, [nodes, edges]);

  const executeWorkflow = useCallback(async () => {
    try {
      // In a real app, this would send the workflow to the backend for execution
      // For now, we'll simulate the execution
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      return true;
    } catch (error) {
      console.error('Error executing workflow:', error);
      return false;
    }
  }, [nodes, edges]);

  const value = {
    nodes,
    edges,
    selectedNode,
    setNodes,
    setEdges,
    setSelectedNode,
    saveWorkflow,
    loadWorkflow,
    clearWorkflow,
    updateNodeData,
    validateWorkflow,
    executeWorkflow
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
}