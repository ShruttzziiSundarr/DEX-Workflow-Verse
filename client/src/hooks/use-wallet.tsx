import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Wallet {
  address: string;
  privateKey?: string;
  isConnected: boolean;
}

interface WalletContextType {
  wallet: Wallet | null;
  isConnecting: boolean;
  connectWallet: (address: string, privateKey?: string) => Promise<boolean>;
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

  const connectWallet = useCallback(async (address: string, privateKey?: string) => {
    if (!address) return false;

    setIsConnecting(true);
    try {
      // Validate the wallet address with the backend
      // In a real app, this would verify the wallet signature
      const res = await apiRequest('POST', '/api/wallet/validate', { address });
      const data = await res.json();

      if (data.valid) {
        const newWallet = { address, privateKey, isConnected: true };
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
