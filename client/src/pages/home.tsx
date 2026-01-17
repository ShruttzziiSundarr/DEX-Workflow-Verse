// import { WalletProvider } from "@/hooks/use-wallet";
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { WalletConnector } from "@/components/WalletConnector";
import { ModuleLibrary } from "@/components/ModuleLibrary";
import { WorkflowCanvasWrapper } from "@/components/WorkflowCanvas";
import { ConfigPanel } from "@/components/ConfigPanel";
import { Button } from "@/components/ui/button";
// import { useWorkflow } from "@/hooks/use-workflow";
import { Toaster } from "@/components/ui/toaster";

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

export default function Home() {
  // Temporary placeholder functions until we fix the workflow context
  const saveWorkflow = async () => {
    alert("Save workflow functionality is temporarily disabled");
    return true;
  };
  
  const clearWorkflow = () => {
    alert("Clear workflow functionality is temporarily disabled");
  };
  const [activePanel, setActivePanel] = useState<"modules" | "canvas" | "config">("canvas");

  const handleSave = async () => {
    await saveWorkflow();
  };

  const handleLoad = () => {
    // For simplicity, we'll load the first workflow
    // In a real app, this would show a modal with a list of workflows
    alert("This would open a modal to select a workflow to load");
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
      <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
        <header className="bg-card border-b border-border py-3 px-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="text-primary text-2xl font-bold">DEX</div>
            <div className="text-foreground text-2xl font-light">WorkflowVerse</div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2">
              <Button 
                variant="outline" 
                onClick={handleSave}
                className="flex items-center space-x-1 bg-secondary hover:bg-accent"
              >
                <span className="material-icons text-sm">save</span>
                <span>Save</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleLoad}
                className="flex items-center space-x-1 bg-secondary hover:bg-accent"
              >
                <span className="material-icons text-sm">folder_open</span>
                <span>Load</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => window.location.href = "/workflows"}
                className="flex items-center space-x-1 bg-dark-200 hover:bg-dark-100 mr-2"
              >
                <span className="material-icons text-sm">list</span>
                <span>Workflows</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => window.location.href = "/visual"}
                className="flex items-center space-x-1 bg-secondary hover:bg-accent"
              >
                <span className="material-icons text-sm">schema</span>
                <span>Visual Builder</span>
              </Button>
            </div>
            
            <WalletConnector />
          </div>
        </header>
        
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
          <Button
            variant="ghost"
            className={`flex flex-col items-center ${activePanel === "modules" ? "text-foreground" : "text-muted-foreground"}`}
            onClick={() => setActivePanel("modules")}
          >
            <span className="material-icons">category</span>
            <span className="text-xs mt-1">Modules</span>
          </Button>
          
          <Button
            variant="ghost"
            className={`flex flex-col items-center ${activePanel === "canvas" ? "text-white" : "text-gray-400"}`}
            onClick={() => setActivePanel("canvas")}
          >
            <span className="material-icons">dashboard</span>
            <span className="text-xs mt-1">Canvas</span>
          </Button>
          
          <Button
            variant="ghost"
            className={`flex flex-col items-center ${activePanel === "config" ? "text-white" : "text-gray-400"}`}
            onClick={() => setActivePanel("config")}
          >
            <span className="material-icons">settings</span>
            <span className="text-xs mt-1">Configure</span>
          </Button>
          
          <Button
            variant="ghost"
            className="flex flex-col items-center text-gray-400"
            onClick={handleSave}
          >
            <span className="material-icons">save</span>
            <span className="text-xs mt-1">Save</span>
          </Button>
        </div>
      </div>
    </WalletProvider>
  );
}
