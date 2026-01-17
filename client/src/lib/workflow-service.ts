import { Node, Edge } from 'reactflow';
import { apiRequest } from '@/lib/queryClient';
import { Workflow } from '@shared/schema';

interface SaveWorkflowParams {
  id?: number;
  name: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];
}

interface StoredWorkflow {
  id: number;
  name: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];
  created: string;
  updated: string;
}

// This service handles workflow storage and retrieval
class WorkflowService {
  async saveWorkflow(params: SaveWorkflowParams): Promise<boolean> {
    try {
      // First try to save to backend
      try {
        const timestamp = new Date().toISOString();
        const workflowData = {
          userId: 1, // This would be the actual user ID in a real app
          name: params.name,
          description: params.description || '',
          nodes: params.nodes,
          edges: params.edges,
          created: timestamp,
          updated: timestamp,
        };
        
        if (params.id) {
          await apiRequest('PUT', `/api/workflows/${params.id}`, workflowData);
        } else {
          await apiRequest('POST', '/api/workflows', workflowData);
        }
        return true;
      } catch (error) {
        console.warn('Failed to save to backend, saving to localStorage instead', error);
        
        // Fallback to localStorage
        const storedWorkflows = this.getStoredWorkflows();
        const timestamp = new Date().toISOString();
        
        if (params.id) {
          const index = storedWorkflows.findIndex(w => w.id === params.id);
          if (index !== -1) {
            storedWorkflows[index] = {
              ...storedWorkflows[index],
              name: params.name,
              description: params.description,
              nodes: params.nodes,
              edges: params.edges,
              updated: timestamp,
            };
          }
        } else {
          const newId = storedWorkflows.length > 0 
            ? Math.max(...storedWorkflows.map(w => w.id)) + 1 
            : 1;
            
          storedWorkflows.push({
            id: newId,
            name: params.name,
            description: params.description,
            nodes: params.nodes,
            edges: params.edges,
            created: timestamp,
            updated: timestamp,
          });
        }
        
        localStorage.setItem('workflows', JSON.stringify(storedWorkflows));
        return true;
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
      return false;
    }
  }

  async loadWorkflow(id: number): Promise<StoredWorkflow | null> {
    try {
      // First try to load from backend
      try {
        const res = await apiRequest('GET', `/api/workflows/${id}`, undefined);
        return await res.json();
      } catch (error) {
        console.warn('Failed to load from backend, trying localStorage', error);
        
        // Fallback to localStorage
        const storedWorkflows = this.getStoredWorkflows();
        return storedWorkflows.find(w => w.id === id) || null;
      }
    } catch (error) {
      console.error('Error loading workflow:', error);
      return null;
    }
  }

  async getWorkflows(): Promise<StoredWorkflow[]> {
    try {
      // First try to get from backend
      try {
        const res = await apiRequest('GET', '/api/workflows', undefined);
        return await res.json();
      } catch (error) {
        console.warn('Failed to get workflows from backend, using localStorage', error);
        
        // Fallback to localStorage
        return this.getStoredWorkflows();
      }
    } catch (error) {
      console.error('Error getting workflows:', error);
      return [];
    }
  }

  async deleteWorkflow(id: number): Promise<boolean> {
    try {
      // First try to delete from backend
      try {
        await apiRequest('DELETE', `/api/workflows/${id}`, undefined);
        return true;
      } catch (error) {
        console.warn('Failed to delete from backend, using localStorage', error);
        
        // Fallback to localStorage
        const storedWorkflows = this.getStoredWorkflows();
        const filtered = storedWorkflows.filter(w => w.id !== id);
        
        if (filtered.length !== storedWorkflows.length) {
          localStorage.setItem('workflows', JSON.stringify(filtered));
          return true;
        }
        return false;
      }
    } catch (error) {
      console.error('Error deleting workflow:', error);
      return false;
    }
  }

  // Helper method to get workflows from localStorage
  private getStoredWorkflows(): StoredWorkflow[] {
    try {
      const stored = localStorage.getItem('workflows');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error parsing stored workflows', error);
      return [];
    }
  }
}

export const workflowService = new WorkflowService();
