import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { ActionType } from "@shared/schema";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Copy, Save } from "lucide-react";

// Action templates
const ACTION_TEMPLATES = [
  {
    id: "httpRequest",
    name: "HTTP Request",
    description: "Make an API call to an external service",
    defaultConfig: {
      url: "",
      method: "GET",
      headers: "{}",
      body: "",
    },
    parameterSchema: {
      url: {
        type: "text",
        label: "URL",
        description: "The endpoint URL to call",
        placeholder: "https://api.example.com/data",
        required: true,
      },
      method: {
        type: "select",
        label: "Method",
        description: "HTTP method to use",
        options: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        defaultValue: "GET",
        required: true,
      },
      headers: {
        type: "json",
        label: "Headers",
        description: "HTTP headers as JSON object",
        placeholder: '{ "Content-Type": "application/json" }',
        required: false,
      },
      body: {
        type: "textarea",
        label: "Request Body",
        description: "JSON body to send with POST/PUT requests",
        placeholder: '{ "key": "value" }',
        required: false,
      },
    },
  },
  {
    id: "smartContractCall",
    name: "Smart Contract Call",
    description: "Execute a function on a blockchain smart contract",
    defaultConfig: {
      contractAddress: "",
      functionName: "",
      abi: "",
      parameters: "[]",
      value: "0",
    },
    parameterSchema: {
      contractAddress: {
        type: "text",
        label: "Contract Address",
        description: "The address of the smart contract",
        placeholder: "0x...",
        required: true,
      },
      functionName: {
        type: "text",
        label: "Function Name",
        description: "The name of the function to call",
        placeholder: "transfer",
        required: true,
      },
      abi: {
        type: "textarea",
        label: "Contract ABI",
        description: "JSON ABI for the function or entire contract",
        placeholder: "[{\"inputs\":[{\"name\":\"recipient\",\"type\":\"address\"},{\"name\":\"amount\",\"type\":\"uint256\"}],\"name\":\"transfer\",\"outputs\":[{\"name\":\"\",\"type\":\"bool\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"}]",
        required: true,
      },
      parameters: {
        type: "json",
        label: "Function Parameters",
        description: "Parameters to pass to the contract function (as JSON array)",
        placeholder: "[\"0x123...\", \"1000000000\"]",
        required: false,
      },
      value: {
        type: "text",
        label: "ETH Value",
        description: "Amount of ETH to send with the transaction (in wei)",
        placeholder: "0",
        required: false,
      },
    },
  },
  {
    id: "defiSwap",
    name: "DeFi Token Swap",
    description: "Swap one token for another on a decentralized exchange",
    defaultConfig: {
      sourceToken: "",
      targetToken: "",
      amount: "",
      slippage: "0.5",
      useBestRoute: true,
      dex: "uniswap",
    },
    parameterSchema: {
      sourceToken: {
        type: "text",
        label: "Source Token",
        description: "Token symbol or address to swap from",
        placeholder: "ETH",
        required: true,
      },
      targetToken: {
        type: "text",
        label: "Target Token",
        description: "Token symbol or address to swap to",
        placeholder: "USDC",
        required: true,
      },
      amount: {
        type: "text",
        label: "Amount",
        description: "Amount of source token to swap",
        placeholder: "0.1",
        required: true,
      },
      slippage: {
        type: "text",
        label: "Slippage Tolerance (%)",
        description: "Maximum price slippage you're willing to accept",
        placeholder: "0.5",
        required: false,
      },
      useBestRoute: {
        type: "switch",
        label: "Use Best Route",
        description: "Automatically find the best swap route",
        required: false,
      },
      dex: {
        type: "select",
        label: "DEX",
        description: "Decentralized exchange to use",
        options: ["uniswap", "sushiswap", "curve", "balancer"],
        defaultValue: "uniswap",
        required: false,
      },
    },
  },
  {
    id: "tokenTransfer",
    name: "Token Transfer",
    description: "Transfer tokens to a wallet address",
    defaultConfig: {
      token: "",
      recipient: "",
      amount: "",
      memo: "",
    },
    parameterSchema: {
      token: {
        type: "text",
        label: "Token",
        description: "Token symbol or contract address",
        placeholder: "ETH",
        required: true,
      },
      recipient: {
        type: "text",
        label: "Recipient Address",
        description: "Wallet address to send tokens to",
        placeholder: "0x...",
        required: true,
      },
      amount: {
        type: "text",
        label: "Amount",
        description: "Amount of tokens to transfer",
        placeholder: "0.1",
        required: true,
      },
      memo: {
        type: "text",
        label: "Memo (Optional)",
        description: "Add a note to this transfer",
        placeholder: "Payment for services",
        required: false,
      },
    },
  },
  {
    id: "emailSend",
    name: "Send Email",
    description: "Send an email notification",
    defaultConfig: {
      recipient: "",
      subject: "",
      body: "",
    },
    parameterSchema: {
      recipient: {
        type: "text",
        label: "Recipient",
        description: "Email address of the recipient",
        placeholder: "user@example.com",
        required: true,
      },
      subject: {
        type: "text",
        label: "Subject",
        description: "Subject line of the email",
        placeholder: "Transaction Completed",
        required: true,
      },
      body: {
        type: "textarea",
        label: "Body",
        description: "Email content (supports template variables like {{amount}})",
        placeholder: "Your transaction of {{amount}} {{token}} has been completed.",
        required: true,
      },
    },
  },
  {
    id: "waitForCondition",
    name: "Wait For Condition",
    description: "Wait until a specific condition is met before continuing",
    defaultConfig: {
      type: "time",
      timeDelay: "60",
      blockConfirmations: "1",
      priceTarget: "",
      priceComparison: "above",
      asset: "",
    },
    parameterSchema: {
      type: {
        type: "select",
        label: "Condition Type",
        description: "Type of condition to wait for",
        options: ["time", "blockConfirmations", "price"],
        defaultValue: "time",
        required: true,
      },
      timeDelay: {
        type: "text",
        label: "Time Delay (seconds)",
        description: "Number of seconds to wait",
        placeholder: "60",
        required: false,
      },
      blockConfirmations: {
        type: "text",
        label: "Block Confirmations",
        description: "Number of block confirmations to wait for",
        placeholder: "1",
        required: false,
      },
      priceTarget: {
        type: "text",
        label: "Price Target",
        description: "Target price to wait for",
        placeholder: "1800",
        required: false,
      },
      priceComparison: {
        type: "select",
        label: "Price Comparison",
        description: "Comparison operator for price",
        options: ["above", "below", "equal"],
        defaultValue: "above",
        required: false,
      },
      asset: {
        type: "text",
        label: "Asset",
        description: "Asset to monitor (for price conditions)",
        placeholder: "ETH",
        required: false,
      },
    },
  },
];

// Define a type for saved action templates
interface SavedTemplate {
  id: string;
  name: string;
  type: string;
  config: Record<string, any>;
}

// Define the form schema
const workflowFormSchema = z.object({
  name: z.string().min(1, "Workflow name is required"),
  description: z.string().optional(),
  actions: z.array(
    z.object({
      name: z.string().min(1, "Action name is required"),
      type: z.string({
        required_error: "Please select an action type",
      }),
      config: z.record(z.any()).optional(),
      order: z.number(),
    })
  ).min(1, "At least one action is required"),
});

type WorkflowFormValues = z.infer<typeof workflowFormSchema>;

const defaultValues: WorkflowFormValues = {
  name: "",
  description: "",
  actions: [
    {
      name: "",
      type: "httpRequest",
      config: ACTION_TEMPLATES.find(t => t.id === "httpRequest")?.defaultConfig || {},
      order: 0,
    },
  ],
};

export default function WorkflowCreationForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");

  // Initialize form
  const form = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowFormSchema),
    defaultValues,
  });

  // Load saved templates on mount
  useEffect(() => {
    const loadSavedTemplates = () => {
      const savedTemplatesJson = localStorage.getItem("actionTemplates");
      if (savedTemplatesJson) {
        try {
          const templates = JSON.parse(savedTemplatesJson);
          if (Array.isArray(templates)) {
            setSavedTemplates(templates);
          }
        } catch (error) {
          console.error("Error loading saved templates:", error);
        }
      }
    };
    
    loadSavedTemplates();
  }, []);

  // Save templates to localStorage
  const persistTemplates = (templates: SavedTemplate[]) => {
    localStorage.setItem("actionTemplates", JSON.stringify(templates));
  };

  const onSubmit = async (data: WorkflowFormValues) => {
    setIsSubmitting(true);
    try {
      // Ensure configs are valid
      const validatedActions = data.actions.map(action => {
        // Find template for this action type
        const template = ACTION_TEMPLATES.find(t => t.id === action.type);
        if (!template) return action;
        
        // Validate config based on required parameters
        const validatedConfig = { ...action.config };
        Object.entries(template.parameterSchema).forEach(([key, schema]) => {
          if (schema.required && (!validatedConfig[key] || validatedConfig[key] === "")) {
            throw new Error(`${schema.label} is required for action ${action.name}`);
          }
        });
        
        return { ...action, config: validatedConfig };
      });
      
      // Prepare the workflow data for API
      const workflowData = {
        name: data.name,
        description: data.description || "",
        // Add empty placeholders for nodes and edges (required by the schema)
        nodes: [],
        edges: [],
      };

      // Create the workflow
      const response = await apiRequest("POST", "/api/workflows", workflowData);
      const workflow = await response.json();

      // Add each action to the workflow
      for (const action of validatedActions) {
        await apiRequest("POST", `/api/workflows/${workflow.id}/actions`, action);
      }

      toast({
        title: "Success",
        description: "Workflow created successfully!",
      });

      // Reset the form
      form.reset(defaultValues);
    } catch (error) {
      console.error("Error creating workflow:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create workflow. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Find a template by its ID
  const getTemplateById = (templateId: string) => {
    return ACTION_TEMPLATES.find(template => template.id === templateId);
  };

  // Add a new action to the workflow
  const addAction = () => {
    const actions = form.getValues("actions") || [];
    const defaultTemplateId = "httpRequest";
    const defaultTemplate = getTemplateById(defaultTemplateId);
    
    form.setValue("actions", [
      ...actions,
      {
        name: "",
        type: defaultTemplateId,
        config: defaultTemplate ? { ...defaultTemplate.defaultConfig } : {},
        order: actions.length,
      },
    ]);
  };

  // Remove an action from the workflow
  const removeAction = (index: number) => {
    const actions = form.getValues("actions") || [];
    if (actions.length <= 1) {
      toast({
        title: "Error",
        description: "At least one action is required",
        variant: "destructive",
      });
      return;
    }
    
    const updatedActions = actions.filter((_, i) => i !== index).map((action, i) => ({
      ...action,
      order: i,
    }));
    
    form.setValue("actions", updatedActions);
  };

  // Update action type and reset config when template changes
  const handleActionTypeChange = (value: string, index: number) => {
    const template = getTemplateById(value);
    if (template) {
      form.setValue(`actions.${index}.type`, value);
      form.setValue(`actions.${index}.config`, { ...template.defaultConfig });
    }
  };

  // Save the current action as a template
  const saveActionAsTemplate = (index: number) => {
    const action = form.getValues(`actions.${index}`);
    setSelectedTemplateIndex(index);
    setNewTemplateName(action.name);
    setShowSaveTemplateModal(true);
  };

  // Confirm saving the template
  const confirmSaveTemplate = () => {
    if (selectedTemplateIndex === null || !newTemplateName) return;
    
    const action = form.getValues(`actions.${selectedTemplateIndex}`);
    const newTemplate: SavedTemplate = {
      id: `custom_${Date.now()}`,
      name: newTemplateName,
      type: action.type,
      config: { ...action.config },
    };
    
    const updatedTemplates = [...savedTemplates, newTemplate];
    setSavedTemplates(updatedTemplates);
    persistTemplates(updatedTemplates);
    
    setShowSaveTemplateModal(false);
    setSelectedTemplateIndex(null);
    setNewTemplateName("");
    
    toast({
      title: "Template Saved",
      description: `'${newTemplateName}' has been saved as a template.`,
    });
  };

  // Apply a saved template to an action
  const applyTemplate = (templateIndex: number, actionIndex: number) => {
    const template = savedTemplates[templateIndex];
    form.setValue(`actions.${actionIndex}.type`, template.type);
    form.setValue(`actions.${actionIndex}.config`, { ...template.config });
    form.setValue(`actions.${actionIndex}.name`, template.name);
    
    toast({
      description: `Template '${template.name}' applied.`,
    });
  };

  // Render parameter input based on its type
  const renderParameterInput = (paramDef: any, index: number, paramKey: string) => {
    // Using Path type from react-hook-form to ensure type safety
    const path = `actions.${index}.config` as `actions.${number}.config`;
    
    switch (paramDef.type) {
      case "text":
        return (
          <FormField
            key={`${path}.${paramKey}`}
            control={form.control}
            // Use bracket notation to properly set nested object properties
            name={`actions.${index}.config`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{paramDef.label}{paramDef.required && " *"}</FormLabel>
                <FormControl>
                  <Input 
                    placeholder={paramDef.placeholder} 
                    value={(field.value && field.value[paramKey]) || ""}
                    onChange={(e) => {
                      // Update just this key in the config object
                      const updatedConfig = { ...field.value, [paramKey]: e.target.value };
                      field.onChange(updatedConfig);
                    }}
                  />
                </FormControl>
                {paramDef.description && (
                  <FormDescription>{paramDef.description}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case "textarea":
        return (
          <FormField
            key={`${path}.${paramKey}`}
            control={form.control}
            name={`actions.${index}.config`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{paramDef.label}{paramDef.required && " *"}</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder={paramDef.placeholder} 
                    className="min-h-[100px]"
                    value={(field.value && field.value[paramKey]) || ""}
                    onChange={(e) => {
                      const updatedConfig = { ...field.value, [paramKey]: e.target.value };
                      field.onChange(updatedConfig);
                    }}
                  />
                </FormControl>
                {paramDef.description && (
                  <FormDescription>{paramDef.description}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case "json":
        return (
          <FormField
            key={`${path}.${paramKey}`}
            control={form.control}
            name={`actions.${index}.config`}
            render={({ field }) => {
              // Format JSON if it's valid
              const formattedValue = (() => {
                try {
                  const value = field.value && field.value[paramKey];
                  if (value && typeof value === 'string') {
                    const parsed = JSON.parse(value);
                    return JSON.stringify(parsed, null, 2);
                  }
                  return value || "";
                } catch {
                  return (field.value && field.value[paramKey]) || "";
                }
              })();
              
              return (
                <FormItem>
                  <FormLabel>{paramDef.label}{paramDef.required && " *"}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={paramDef.placeholder} 
                      className="font-mono min-h-[100px]" 
                      value={formattedValue}
                      onChange={(e) => {
                        // Preserve original string even if it's invalid JSON
                        const updatedConfig = { ...field.value, [paramKey]: e.target.value };
                        field.onChange(updatedConfig);
                      }}
                    />
                  </FormControl>
                  {paramDef.description && (
                    <FormDescription>{paramDef.description}</FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        );
      
      case "select":
        return (
          <FormField
            key={`${path}.${paramKey}`}
            control={form.control}
            name={`actions.${index}.config`}
            render={({ field }) => {
              const currentValue = field.value && field.value[paramKey];
              
              return (
                <FormItem>
                  <FormLabel>{paramDef.label}{paramDef.required && " *"}</FormLabel>
                  <Select
                    value={currentValue || paramDef.defaultValue || ""}
                    onValueChange={(value) => {
                      const updatedConfig = { ...field.value, [paramKey]: value };
                      field.onChange(updatedConfig);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${paramDef.label.toLowerCase()}`} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {paramDef.options.map((option: string) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {paramDef.description && (
                    <FormDescription>{paramDef.description}</FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        );
      
      case "switch":
        return (
          <FormField
            key={`${path}.${paramKey}`}
            control={form.control}
            name={`actions.${index}.config`}
            render={({ field }) => {
              const isChecked = field.value && field.value[paramKey] === true;
              
              return (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{paramDef.label}</FormLabel>
                    {paramDef.description && (
                      <FormDescription>{paramDef.description}</FormDescription>
                    )}
                  </div>
                  <FormControl>
                    <Switch
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        const updatedConfig = { ...field.value, [paramKey]: checked };
                        field.onChange(updatedConfig);
                      }}
                    />
                  </FormControl>
                </FormItem>
              );
            }}
          />
        );
      
      case "checkbox":
        return (
          <FormField
            key={`${path}.${paramKey}`}
            control={form.control}
            name={`actions.${index}.config`}
            render={({ field }) => {
              const isChecked = field.value && field.value[paramKey] === true;
              
              return (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        const updatedConfig = { ...field.value, [paramKey]: checked };
                        field.onChange(updatedConfig);
                      }}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>{paramDef.label}</FormLabel>
                    {paramDef.description && (
                      <FormDescription>{paramDef.description}</FormDescription>
                    )}
                  </div>
                </FormItem>
              );
            }}
          />
        );
      
      default:
        return (
          <div key={`${path}.${paramKey}`} className="text-sm text-gray-500">
            Unknown parameter type: {paramDef.type}
          </div>
        );
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Create New Workflow</CardTitle>
        <CardDescription>
          Define your workflow by adding and configuring actions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workflow Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="My Workflow" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Describe the purpose of this workflow" {...field} />
                    </FormControl>
                    <FormDescription>
                      Add a description to help you remember what this workflow does
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Actions</h3>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addAction}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add Action
                </Button>
              </div>
              
              {form.watch("actions").map((action, index) => {
                const actionType = action.type;
                const template = getTemplateById(actionType);
                
                return (
                  <div key={index} className="p-5 border rounded-lg space-y-5 bg-gray-50">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium text-lg">Action {index + 1}</h4>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => saveActionAsTemplate(index)}
                          title="Save as template"
                        >
                          <Save className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAction(index)}
                          title="Remove action"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`actions.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Action Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Fetch Data" {...field} />
                            </FormControl>
                            <FormDescription>
                              A descriptive name for this action
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`actions.${index}.type`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Action Type *</FormLabel>
                            <Select
                              onValueChange={(value) => handleActionTypeChange(value, index)}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select action type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="header" disabled className="font-semibold">
                                  Built-in Templates
                                </SelectItem>
                                {ACTION_TEMPLATES.map(template => (
                                  <SelectItem key={template.id} value={template.id}>
                                    {template.name}
                                  </SelectItem>
                                ))}
                                
                                {savedTemplates.length > 0 && (
                                  <>
                                    <SelectItem value="divider" disabled className="border-t my-1">
                                      ─────────
                                    </SelectItem>
                                    <SelectItem value="header2" disabled className="font-semibold">
                                      Your Templates
                                    </SelectItem>
                                    {savedTemplates.map(template => (
                                      <SelectItem 
                                        key={template.id} 
                                        value={template.id}
                                        className="italic"
                                      >
                                        {template.name} (Custom)
                                      </SelectItem>
                                    ))}
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              {template?.description || "Select a template for this action"}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {/* Saved templates dropdown when applicable */}
                    {savedTemplates.length > 0 && (
                      <div className="bg-blue-50 p-4 rounded-md">
                        <h5 className="font-medium text-sm mb-2">Apply Saved Template</h5>
                        <div className="flex gap-2 flex-wrap">
                          {savedTemplates.map((template, i) => (
                            <Button
                              key={template.id}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => applyTemplate(i, index)}
                              className="bg-white flex items-center gap-1"
                            >
                              <Copy className="h-3 w-3" />
                              {template.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Dynamic parameter fields */}
                    {template && (
                      <div className="border-t pt-4 mt-4 space-y-4">
                        <h5 className="font-medium">Configuration</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Object.entries(template.parameterSchema).map(([key, paramDef]) => 
                            renderParameterInput(paramDef, index, key)
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting}
              size="lg"
            >
              {isSubmitting ? "Creating Workflow..." : "Create Workflow"}
            </Button>
          </form>
        </Form>
      </CardContent>
      
      {/* Template save modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Save as Template</h3>
            <div className="mb-4">
              <FormLabel>Template Name</FormLabel>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="My Template"
                className="mb-2"
              />
              <FormDescription>
                Give your template a descriptive name so you can find it later
              </FormDescription>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowSaveTemplateModal(false);
                  setSelectedTemplateIndex(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmSaveTemplate}
                disabled={!newTemplateName}
              >
                Save Template
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}