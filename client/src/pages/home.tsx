// import { WalletProvider } from "@/hooks/use-wallet";
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { WalletConnector } from "@/components/WalletConnector";
import { ModuleLibrary } from "@/components/ModuleLibrary";
import { WorkflowCanvasWrapper } from "@/components/WorkflowCanvas";
import { ConfigPanel } from "@/components/ConfigPanel";
import { OperationManual } from "@/components/OperationManual";
import { Button } from "@/components/ui/button";
import { useWorkflow } from "@/hooks/use-workflow";
import { workflowService } from "@/lib/workflow-service";
import { Toaster } from "@/components/ui/toaster";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Wallet {
  address: string;
  isConnected: boolean;
}

interface WalletContextType {
  wallet: Wallet | null;
  isConnecting: boolean;
  connectWallet: (address: string) => Promise<boolean>;
  disconnectWallet: () => Promise<boolean>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  // Load wallet from localStorage on mount
  useEffect(() => {
    const savedWallet = localStorage.getItem('wallet');
    if (savedWallet) {
      try {
        setWallet(JSON.parse(savedWallet));
      } catch (error) {
        console.error('Error parsing saved wallet', error);
        localStorage.removeItem('wallet');
      }
    }
  }, []);

  const connectWallet = useCallback(async (address: string) => {
    if (!address) return false;

    setIsConnecting(true);
    try {
      // Validate the wallet address with the backend
      // In a real app, this would verify the wallet signature
      const res = await apiRequest('POST', '/api/wallet/validate', { address });
      const data = await res.json();

      if (data.valid) {
        const newWallet = { address, isConnected: true };
        setWallet(newWallet);
        localStorage.setItem('wallet', JSON.stringify(newWallet));
        
        toast({
          title: 'Wallet Connected',
          description: `Connected to ${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
        });
        return true;
      } else {
        toast({
          title: 'Connection Failed',
          description: data.message || 'Could not connect to wallet',
          variant: 'destructive',
        });
        return false;
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast({
        title: 'Connection Error',
        description: 'An error occurred while connecting to your wallet',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [toast]);

  const disconnectWallet = useCallback(async () => {
    setWallet(null);
    localStorage.removeItem('wallet');
    
    toast({
      title: 'Wallet Disconnected',
      description: 'Your wallet has been disconnected',
    });
    return true;
  }, [toast]);

  const value = {
    wallet,
    isConnecting,
    connectWallet,
    disconnectWallet
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

interface StoredWorkflow {
  id: number;
  name: string;
  description?: string;
  created: string;
  updated: string;
}

export default function Home() {
  const { saveWorkflow, loadWorkflow } = useWorkflow();
  const { toast } = useToast();
  const [activePanel, setActivePanel] = useState<"modules" | "canvas" | "config">("canvas");
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [savedWorkflows, setSavedWorkflows] = useState<StoredWorkflow[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoading, setIsLoading] = useState<number | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSelectedType, setManualSelectedType] = useState<string | undefined>();
  const [showBanner, setShowBanner] = useState(() => {
    return localStorage.getItem('hideHelpBanner') !== 'true';
  });

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem('hideHelpBanner', 'true');
  };

  // Listen for open-operation-manual events from TimeComparisonPanel & other components
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setManualSelectedType(typeof detail === 'string' ? detail : undefined);
      setManualOpen(true);
    };
    window.addEventListener('open-operation-manual', handler);
    return () => window.removeEventListener('open-operation-manual', handler);
  }, []);

  // Deep-linking from Explore Page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const pool = params.get('pool');
    
    if (action && pool) {
      const newNodeId = `node-${Date.now()}`;
      const type = action === 'lp' ? 'liquidity' : 'swap';
      
      const newNode = {
        id: newNodeId,
        type: 'workflowNode',
        position: { x: 250, y: 150 },
        data: {
          label: action === 'lp' ? 'Add Liquidity' : 'Token Swap',
          type: type as any,
          config: {
            poolAddress: pool,
            protocol: 'raydium', // Default for deep-links
            poolId: pool
          }
        }
      };
      
      setNodes((nds: any) => [...nds, newNode]);
      
      toast({
        title: 'Module Imported',
        description: `Imported ${type} configuration for pool ${pool.substring(0, 8)}...`,
      });

      // Clear params to avoid duplicate adds
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [setNodes, toast]);

  const handleSave = async () => {
    await saveWorkflow();
  };

  const handleLoad = async () => {
    setIsLoadingList(true);
    setShowLoadDialog(true);
    try {
      const workflows = await workflowService.getWorkflows();
      setSavedWorkflows(workflows as StoredWorkflow[]);
    } catch (err) {
      toast({ title: 'Failed to fetch workflows', variant: 'destructive' });
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleSelectWorkflow = async (id: number, name: string) => {
    setIsLoading(id);
    const success = await loadWorkflow(id);
    if (success) {
      setShowLoadDialog(false);
      toast({ title: 'Workflow Loaded', description: `"${name}" is now on the canvas.` });
    }
    setIsLoading(null);
  };

  // Mobile nav panel switcher
  const renderMobileContent = () => {
    switch (activePanel) {
      case "modules":
        return <ModuleLibrary />;
      case "canvas":
        return <WorkflowCanvasWrapper />;
      case "config":
        return <ConfigPanel />;
      default:
        return <WorkflowCanvasWrapper />;
    }
  };

  return (
    <WalletProvider>
      {/* Load Workflow Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Load Workflow</DialogTitle>
            <DialogDescription>Select a saved workflow to load onto the canvas.</DialogDescription>
          </DialogHeader>
          <div className="mt-2 max-h-80 overflow-y-auto space-y-2">
            {isLoadingList && (
              <p className="text-sm text-muted-foreground text-center py-4">Loading workflows...</p>
            )}
            {!isLoadingList && savedWorkflows.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No saved workflows found.</p>
            )}
            {!isLoadingList && savedWorkflows.map((wf) => (
              <div
                key={wf.id}
                className="flex items-center justify-between p-3 rounded-md border border-border bg-card hover:bg-accent transition-colors"
              >
                <div className="overflow-hidden mr-3">
                  <p className="font-medium text-sm truncate">{wf.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(wf.updated).toLocaleDateString()} {new Date(wf.updated).toLocaleTimeString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={isLoading === wf.id}
                  onClick={() => handleSelectWorkflow(wf.id, wf.name)}
                >
                  {isLoading === wf.id ? 'Loading...' : 'Load'}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
        <header className="bg-card border-b border-border py-2.5 px-4 flex items-center justify-between gap-4">
          {/* Brand */}
          <a href="/" className="flex items-center gap-1 shrink-0 hover:opacity-80 transition-opacity">
            <span className="text-primary text-xl font-bold tracking-tight">DEX</span>
            <span className="text-foreground text-xl font-light tracking-tight">WorkflowVerse</span>
          </a>

          {/* Nav actions */}
          <div className="hidden md:flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              className="flex items-center gap-1.5 text-sm"
            >
              <span className="material-icons text-sm">save</span>
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoad}
              className="flex items-center gap-1.5 text-sm"
            >
              <span className="material-icons text-sm">folder_open</span>
              Load
            </Button>

            <div className="h-5 w-px bg-border mx-1" />

            <a href="/workflows">
              <Button variant="ghost" size="sm" className="flex items-center gap-1.5 text-sm">
                <span className="material-icons text-sm">list</span>
                Workflows
              </Button>
            </a>
            <a href="/visual">
              <Button variant="ghost" size="sm" className="flex items-center gap-1.5 text-sm">
                <span className="material-icons text-sm">schema</span>
                Visual
              </Button>
            </a>
            <a href="/explore">
              <Button variant="ghost" size="sm" className="flex items-center gap-1.5 text-sm">
                <span className="material-icons text-sm">explore</span>
                Explore
              </Button>
            </a>
            <a href="/dashboard">
              <Button variant="ghost" size="sm" className="flex items-center gap-1.5 text-sm">
                <span className="material-icons text-sm">dashboard</span>
                Dashboard
              </Button>
            </a>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1.5 text-sm"
              onClick={() => setManualOpen(true)}
            >
              <span className="material-icons text-sm">menu_book</span>
              Help
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1.5 text-sm"
              onClick={() => window.dispatchEvent(new CustomEvent('open-execution-history'))}
            >
              <span className="material-icons text-sm">history</span>
              History
            </Button>
          </div>

          <WalletConnector />
        </header>

        {showBanner && (
          <div className="bg-primary/10 border-y border-primary/20 px-4 py-2 flex items-center justify-between shrink-0">
            <p className="text-sm text-foreground/90 font-medium">
              <span className="mr-2 hidden sm:inline">📖</span>
              New here? Read the Operation Manual before building workflows.
              <button 
                onClick={() => setManualOpen(true)}
                className="ml-2 font-bold text-primary hover:opacity-80 underline underline-offset-2"
              >
                Open Manual →
              </button>
            </p>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary/20 text-foreground/70" onClick={dismissBanner}>
              <span className="material-icons text-[16px]">close</span>
            </Button>
          </div>
        )}
        
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop Layout */}
          <div className="hidden md:flex flex-1 overflow-hidden">
            <ModuleLibrary />
            <WorkflowCanvasWrapper />
            <ConfigPanel />
          </div>
          
          {/* Mobile Layout */}
          <div className="flex flex-col flex-1 md:hidden">
            {renderMobileContent()}
          </div>
        </div>
        
        {/* Mobile Bottom Nav */}
        <div className="md:hidden border-t border-border bg-card py-2 px-4 flex justify-around">
          {[
            { id: "modules" as const, icon: "category", label: "Modules" },
            { id: "canvas" as const, icon: "grid_view", label: "Canvas" },
            { id: "config" as const, icon: "settings", label: "Configure" },
          ].map(({ id, icon, label }) => (
            <Button
              key={id}
              variant="ghost"
              className={`flex flex-col items-center gap-0.5 h-auto py-1 ${
                activePanel === id ? "text-primary" : "text-muted-foreground"
              }`}
              onClick={() => setActivePanel(id)}
            >
              <span className="material-icons text-xl">{icon}</span>
              <span className="text-xs">{label}</span>
            </Button>
          ))}
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-0.5 h-auto py-1 text-muted-foreground"
            onClick={handleSave}
          >
            <span className="material-icons text-xl">save</span>
            <span className="text-xs">Save</span>
          </Button>
        </div>
      </div>

      {/* Operation Manual Dialog */}
      <OperationManual
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        selectedType={manualSelectedType}
      />
    </WalletProvider>
  );
}
