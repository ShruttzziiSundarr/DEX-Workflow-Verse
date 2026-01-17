import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { ValidatorSelector } from "@/components/ValidatorSelector";
import { useWorkflow } from "@/hooks/use-workflow";
import { useToast } from "@/hooks/use-toast";
import { ModuleType } from "@shared/schema";

export function WorkflowConfigPanel() {
  const { selectedNode, setNodes } = useWorkflow();
  const { toast } = useToast();

  const handleValidate = () => {
    toast({
      title: "Validating workflow...",
      description: "Checking configuration and connections."
    });
    // Add validation logic here
  };

  const handleExecute = () => {
    toast({
      title: "Executing workflow...",
      description: "Starting execution sequence."
    });
    // Add execution logic here
  };

  return (
    <Card className="h-full border-0 rounded-none">
      <CardHeader className="border-b pb-4">
        <h2 className="text-lg font-semibold">Configuration</h2>
        <p className="text-sm text-gray-500">
          {selectedNode ? "Configure selected module settings" : "Select a module to configure"}
        </p>
      </CardHeader>

      <CardContent className="pt-6">
        {!selectedNode && (
          <div className="text-center text-gray-500 py-8">
            Select a node to configure its settings
          </div>
        )}

        {selectedNode && (
          <div className="space-y-6">
            {/* Module specific configuration will go here */}
            <div className="space-y-4">
              <div>
                <Label>Module Name</Label>
                <Input
                  value={selectedNode.data?.label || ""}
                  onChange={(e) => {
                    setNodes((nds) =>
                      nds.map((node) => {
                        if (node.id === selectedNode.id) {
                          return {
                            ...node,
                            data: { ...node.data, label: e.target.value },
                          };
                        }
                        return node;
                      })
                    );
                  }}
                  placeholder="Enter module name"
                />
              </div>
              
              {/* Add more configuration fields based on module type */}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t flex flex-col gap-2 pt-4">
        <Button
          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          onClick={handleValidate}
        >
          Validate Workflow
        </Button>
        <Button
          className="w-full bg-green-600 hover:bg-green-700 text-white"
          onClick={handleExecute}
        >
          Execute Workflow
        </Button>
      </CardFooter>
    </Card>
  );
}