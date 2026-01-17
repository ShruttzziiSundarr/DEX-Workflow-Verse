import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Workflow, WorkflowExecution } from "@shared/schema";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Play, Trash2, AlertCircle, CheckCircle, Clock } from "lucide-react";

export default function WorkflowList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [executionDialogOpen, setExecutionDialogOpen] = useState(false);
  const [currentExecution, setCurrentExecution] = useState<WorkflowExecution | null>(null);
  const [pollingInterval, setPollingInterval] = useState<number | null>(null);

  // Query to fetch all workflows
  const { data: workflows, isLoading, isError, refetch } = useQuery({
    queryKey: ["/api/workflows"],
    refetchOnWindowFocus: false,
  });

  // Mutation to execute a workflow
  const executeWorkflowMutation = useMutation({
    mutationFn: async (workflowId: number) => {
      const response = await apiRequest("POST", `/api/workflows/${workflowId}/execute`);
      return response.json();
    },
    onSuccess: (data: WorkflowExecution) => {
      setCurrentExecution(data);
      setExecutionDialogOpen(true);
      
      // Start polling for execution status
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      
      const interval = window.setInterval(() => {
        checkExecutionStatus(data.id);
      }, 1000);
      
      setPollingInterval(interval);
    },
    onError: (error) => {
      console.error("Error executing workflow:", error);
      toast({
        title: "Error",
        description: "Failed to execute workflow. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation to delete a workflow
  const deleteWorkflowMutation = useMutation({
    mutationFn: async (workflowId: number) => {
      await apiRequest("DELETE", `/api/workflows/${workflowId}`);
      return workflowId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({
        title: "Success",
        description: "Workflow deleted successfully!",
      });
    },
    onError: (error) => {
      console.error("Error deleting workflow:", error);
      toast({
        title: "Error",
        description: "Failed to delete workflow. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Check execution status
  const checkExecutionStatus = async (executionId: number) => {
    try {
      const response = await apiRequest("GET", `/api/workflows/executions/${executionId}`);
      const execution = await response.json();
      setCurrentExecution(execution);
      
      // Stop polling if execution is completed or failed
      if (execution.status === "completed" || execution.status === "failed") {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
      }
    } catch (error) {
      console.error("Error checking execution status:", error);
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    }
  };

  // Clean up polling interval when component unmounts
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Handle executing a workflow
  const handleExecute = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    executeWorkflowMutation.mutate(workflow.id);
  };

  // Handle deleting a workflow
  const handleDelete = (workflow: Workflow) => {
    if (confirm(`Are you sure you want to delete the workflow "${workflow.name}"?`)) {
      deleteWorkflowMutation.mutate(workflow.id);
    }
  };

  // Render execution status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="flex items-center"><Clock className="mr-1 h-3 w-3" /> Pending</Badge>;
      case "running":
        return <Badge variant="secondary" className="flex items-center"><RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Running</Badge>;
      case "completed":
        return <Badge variant="default" className="flex items-center bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3" /> Completed</Badge>;
      case "failed":
        return <Badge variant="destructive" className="flex items-center"><AlertCircle className="mr-1 h-3 w-3" /> Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-6">Loading workflows...</div>;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center p-6">
        <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
        <p className="text-lg font-semibold text-red-500">Failed to load workflows</p>
        <Button onClick={() => refetch()} variant="outline" className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Your Workflows</CardTitle>
            <CardDescription>Manage and execute your created workflows</CardDescription>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {workflows && Array.isArray(workflows) && workflows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.isArray(workflows) && workflows.map((workflow: Workflow) => (
                <TableRow key={workflow.id}>
                  <TableCell className="font-medium">{workflow.name}</TableCell>
                  <TableCell>{workflow.description || "—"}</TableCell>
                  <TableCell>{new Date(workflow.created).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleExecute(workflow)}
                        variant="default"
                        size="sm"
                        disabled={executeWorkflowMutation.isPending}
                      >
                        {executeWorkflowMutation.isPending && selectedWorkflow?.id === workflow.id ? (
                          <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="mr-1 h-4 w-4" />
                        )}
                        Run
                      </Button>
                      <Button
                        onClick={() => handleDelete(workflow)}
                        variant="outline"
                        size="sm"
                        disabled={deleteWorkflowMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No workflows found. Create one to get started!</p>
          </div>
        )}
        
        {/* Execution Dialog */}
        <Dialog open={executionDialogOpen} onOpenChange={setExecutionDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Workflow Execution
                {selectedWorkflow && ` - ${selectedWorkflow.name}`}
              </DialogTitle>
              <DialogDescription>
                Status: {currentExecution && renderStatusBadge(currentExecution.status)}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {currentExecution && currentExecution.status === "running" && (
                <div className="flex flex-col items-center justify-center p-4">
                  <RefreshCw className="h-12 w-12 text-blue-500 animate-spin mb-2" />
                  <p className="text-center">Executing workflow...</p>
                </div>
              )}
              
              {currentExecution && currentExecution.status === "completed" && (
                <div className="border rounded-md p-4">
                  <div className="flex items-center mb-4">
                    <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
                    <h3 className="font-medium text-green-700">Execution Completed Successfully</h3>
                  </div>
                  
                  {currentExecution.result && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Results:</h4>
                      <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-64">
                        {JSON.stringify(currentExecution.result || {}, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
              
              {currentExecution && currentExecution.status === "failed" && (
                <div className="border border-red-200 rounded-md p-4 bg-red-50">
                  <div className="flex items-center mb-4">
                    <AlertCircle className="h-6 w-6 text-red-500 mr-2" />
                    <h3 className="font-medium text-red-700">Execution Failed</h3>
                  </div>
                  
                  {currentExecution.error && (
                    <div className="mt-2">
                      <h4 className="font-medium mb-1">Error:</h4>
                      <p className="text-red-600">{currentExecution.error}</p>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex justify-end">
                <Button
                  onClick={() => setExecutionDialogOpen(false)}
                  variant="outline"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}