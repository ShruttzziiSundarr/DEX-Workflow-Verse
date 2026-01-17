import React, { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface StakeAccount {
  address: string;
  lamports: number;
  state: string;
  delegationInfo: {
    voter: string;
    stake: number;
    activationEpoch: number;
  } | null;
}

export function MarinadeStaking() {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [stakeAccounts, setStakeAccounts] = useState<StakeAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalStaked, setTotalStaked] = useState(0);

  useEffect(() => {
    if (wallet?.address) {
      fetchStakeAccounts();
    }
  }, [wallet?.address]);

  const fetchStakeAccounts = async () => {
    if (!wallet?.address) return;

    try {
      const response = await apiRequest('GET', `/api/marinade/accounts/${wallet.address}`);
      const data = await response.json();
      
      if (data.success) {
        setStakeAccounts(data.accounts);
        setTotalStaked(data.totalStaked);
      }
    } catch (error) {
      console.error('Error fetching stake accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch stake accounts',
        variant: 'destructive',
      });
    }
  };

  const handleStake = async () => {
    if (!wallet?.address || !amount) return;

    setIsLoading(true);
    try {
      // Get the stake transaction
      const response = await apiRequest('POST', '/api/marinade/stake', {
        action: 'stake',
        amount: parseFloat(amount),
        fromPubkey: wallet.address,
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      // Connect to Solana
      const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
      
      // Deserialize and sign the transaction
      const transaction = Transaction.from(Buffer.from(data.transaction));
      
      // Request signature from wallet
      if (!(window as any).solana) throw new Error('Solana wallet not found');
      const signedTx = await (window as any).solana.signTransaction(transaction);
      
      // Send the signed transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      
      toast({
        title: 'Success',
        description: `Stake transaction sent: ${signature.slice(0, 8)}...`,
      });

      // Refresh stake accounts
      await fetchStakeAccounts();
      setAmount('');
    } catch (error) {
      console.error('Stake error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to stake',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnstake = async (stakeAccountAddress: string) => {
    if (!wallet?.address) return;

    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/marinade/stake', {
        action: 'unstake',
        stakeAccountPubkey: stakeAccountAddress,
        fromPubkey: wallet.address,
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      // Connect to Solana
      const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
      
      // Deserialize and sign the transaction
      const transaction = Transaction.from(Buffer.from(data.transaction));
      
      // Request signature from wallet
      if (!(window as any).solana) throw new Error('Solana wallet not found');
      const signedTx = await (window as any).solana.signTransaction(transaction);
      
      // Send the signed transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      
      toast({
        title: 'Success',
        description: `Unstake transaction sent: ${signature.slice(0, 8)}...`,
      });

      // Refresh stake accounts
      await fetchStakeAccounts();
    } catch (error) {
      console.error('Unstake error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to unstake',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!wallet?.isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Marinade Staking</CardTitle>
          <CardDescription>Connect your wallet to start staking</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Marinade Staking</CardTitle>
        <CardDescription>
          Stake your SOL with Marinade Finance - Earn staking rewards while maintaining liquidity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Total Staked: {totalStaked.toFixed(4)} SOL</h3>
          </div>
          
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              placeholder="Amount in SOL"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.1"
            />
            <Button onClick={handleStake} disabled={isLoading || !amount}>
              {isLoading ? 'Staking...' : 'Stake'}
            </Button>
          </div>

          {stakeAccounts.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Your Stake Accounts</h4>
              {stakeAccounts.map((account) => (
                <div key={account.address} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">Account: {account.address.slice(0, 8)}...</p>
                      <p className="text-sm">Amount: {(account.lamports / 1e9).toFixed(4)} SOL</p>
                      <p className="text-sm">State: {account.state}</p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => handleUnstake(account.address)}
                      disabled={isLoading || account.state === 'deactivating'}
                    >
                      {isLoading ? 'Processing...' : 'Unstake'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="text-sm text-gray-500">
        Note: Unstaking has a cooldown period of ~2 days (1 epoch)
      </CardFooter>
    </Card>
  );
}