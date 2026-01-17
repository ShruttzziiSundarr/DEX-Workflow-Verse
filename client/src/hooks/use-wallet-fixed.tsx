import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';

// Note: avoid declaring a global `Window.solana` type here to prevent conflicts
// with other ambient declarations. Use `(window as any).solana` where needed.

interface Wallet {
  address: string;
  isConnected: boolean;
  timestamp: number;
}

interface WalletContextValue {
  wallet: Wallet | null;
  isConnecting: boolean;
  connectWallet: (address: string) => Promise<boolean>;
  disconnectWallet: () => Promise<boolean>;
  checkWalletConnection: () => Promise<boolean>;
  walletValid: boolean | null;
  isCheckingWallet: boolean;
}

const WalletContext = createContext<WalletContextValue>({
  wallet: null,
  isConnecting: false,
  connectWallet: async () => false,
  disconnectWallet: async () => false,
  checkWalletConnection: async () => false,
  walletValid: null,
  isCheckingWallet: false,
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletValid, setWalletValid] = useState<boolean | null>(null);
  const [isCheckingWallet, setIsCheckingWallet] = useState(false);
  const { toast } = useToast();

  const disconnectWallet = useCallback(async () => {
    setWallet(null);
    localStorage.removeItem('wallet');

    // Try to disconnect from Phantom if available
    try {
      if (typeof window !== 'undefined' && (window as any).solana) {
        await (window as any).solana.disconnect();
      }
    } catch (error) {
      console.error('Error disconnecting from Phantom:', error);
    }

    toast({
      title: 'Wallet Disconnected',
      description: 'Your wallet has been disconnected',
    });
    return true;
  }, [toast]);

  // Handle Phantom connection response
  const handlePhantomResponse = useCallback(async (phantomResponse: any) => {
    try {
      const address = phantomResponse.publicKey.toString();

      // Validate the wallet address with the backend
      const res = await apiRequest('POST', '/api/wallet/validate', { address });
      const data = await res.json();

      if (data.valid) {
        const newWallet = {
          address,
          isConnected: true,
          timestamp: Date.now() // Add timestamp for connection tracking
        };
        setWallet(newWallet);
        localStorage.setItem('wallet', JSON.stringify(newWallet));

        toast({
          title: 'Wallet Connected',
          description: `Connected to ${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
        });
        return true;
      } else {
        throw new Error(data.message || 'Could not validate wallet');
      }
    } catch (error) {
      console.error('Error processing Phantom response:', error);
      throw error;
    }
  }, [toast]);

  const connectWallet = useCallback(async (address?: string) => {
    setIsConnecting(true);
    try {
      // Check if Phantom wallet is installed
      if (typeof window === 'undefined' || !(window as any).solana) {
        toast({
          title: 'Wallet Not Found',
          description: 'Please install Phantom wallet extension',
          variant: 'destructive',
        });
        return false;
      }

      // Try to connect to Phantom
      const solana = (window as any).solana;

      // Check if already connected
      try {
        const resp = await solana.connect({ onlyIfTrusted: true });
        return await handlePhantomResponse(resp);
      } catch (err) {
        // Not already connected, request new connection
        const resp = await solana.connect();
        return await handlePhantomResponse(resp);
      }

    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast({
        title: 'Connection Error',
        description: error instanceof Error ? error.message : 'Failed to connect wallet',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [toast, handlePhantomResponse]);

  // Handle wallet state changes from Phantom
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).solana) return;

    const handleConnect = async () => {
      try {
        const publicKey = (window as any).solana.publicKey;
        if (publicKey) {
          await connectWallet(publicKey.toString());
        }
      } catch (error) {
        console.error('Wallet connect event error:', error);
      }
    };

    const handleDisconnect = () => {
      disconnectWallet();
    };

    const handleAccountChange = async (publicKey: any) => {
      if (publicKey) {
        await connectWallet(publicKey.toString());
      } else {
        disconnectWallet();
      }
    };

    // Subscribe to Phantom wallet events
    (window as any).solana?.on('connect', handleConnect);
    (window as any).solana?.on('disconnect', handleDisconnect);
    (window as any).solana?.on('accountChanged', handleAccountChange);

    // Try to reconnect on mount if we have a saved wallet
    const attemptReconnect = async () => {
      const savedWallet = localStorage.getItem('wallet');
      if (savedWallet) {
        try {
          const parsed = JSON.parse(savedWallet);
          // Only attempt reconnect if saved within last 24 hours
          if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            await connectWallet(parsed.address);
          } else {
            localStorage.removeItem('wallet');
          }
        } catch (error) {
          console.error('Error reconnecting wallet:', error);
          localStorage.removeItem('wallet');
        }
      }
    };

    attemptReconnect();

    return () => {
      // Cleanup event listeners
      (window as any).solana?.removeListener('connect', handleConnect);
      (window as any).solana?.removeListener('disconnect', handleDisconnect);
      (window as any).solana?.removeListener('accountChanged', handleAccountChange);
    };
  }, [connectWallet, disconnectWallet]);

  const checkWalletConnection = useCallback(async () => {
    if (!wallet?.isConnected) return false;

    try {
      const res = await apiRequest('GET', `/api/wallet/status/${wallet.address}`);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Non-OK response from wallet status:', res.status, text);
        return false;
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text().catch(() => '');
        console.error('Unexpected non-JSON response for wallet status:', text);
        return false;
      }
      const data = await res.json();
      return data.isValid;
    } catch (error) {
      console.error('Error checking wallet status:', error);
      return false;
    }
  }, [wallet]);

  // Wallet status polling via React Query to avoid duplicate requests and StrictMode double invokes.
  const walletStatusQuery = useQuery({
    queryKey: ['/api/wallet/status', wallet?.address],
    queryFn: async () => {
      const addr = wallet?.address;
      if (!addr) return null;
      const res = await apiRequest('GET', `/api/wallet/status/${addr}`);
      const data = await res.json();
      return data;
    },
    enabled: Boolean(wallet?.isConnected && wallet?.address),
    refetchInterval: 10000,
    refetchOnWindowFocus: false,
    staleTime: 30000,
    retry: 1,
  });

  useEffect(() => {
    setIsCheckingWallet(Boolean(walletStatusQuery.isFetching));
    if (!wallet?.isConnected) {
      setWalletValid(null);
      return;
    }
    const data = walletStatusQuery.data as any;
    if (data && typeof data.isValid !== 'undefined') {
      setWalletValid(Boolean(data.isValid));
    }
  }, [wallet?.isConnected, walletStatusQuery.data, walletStatusQuery.isFetching]);

  return (
    <WalletContext.Provider
      value={{
        wallet,
        isConnecting,
        connectWallet,
        disconnectWallet,
        checkWalletConnection,
        walletValid,
        isCheckingWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
