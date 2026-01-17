import { Edge, Node } from 'reactflow';
import { ModuleType } from '@shared/schema';

export interface WorkflowNode extends Node {
  data: {
    type: ModuleType;
    label: string;
    config?: Record<string, any>;
  };
}

export interface WorkflowEdge extends Edge {
  // Additional properties specific to workflow edges could be added here
}

export interface SavedWorkflow {
  id: number;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  created: string;
  updated: string;
}

export interface ValidationResult {
  valid: boolean;
  message: string;
}
