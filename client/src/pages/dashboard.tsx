import React, { useState, useEffect, useCallback } from 'react';
import { WalletProvider, useWallet } from '@/pages/home';
import { WalletConnector } from '@/components/WalletConnector';
import { getUserPositionsFromStorage } from '@/lib/solana/liquidityPool';
import { getExecutionHistory, ExecutionRecord } from '@/components/ExecutionHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Wallet,
  Droplets,
  TrendingUp,
  History,
  RefreshCw,
  ExternalLink,
  Activity,
  Layout,
  AlertCircle,
} from 'lucide-react';

// Reverse-lookup map for devnet mock pool addresses → human-readable names
const POOL_NAMES: Record<string, string> = {
  'MockPool11111111111111111111111111111111111': 'SOL/USDC',
  'MockPool22222222222222222222222222222222222': 'SOL/USDT',
  'MockPool33333333333333333333333333333333333': 'RAY/SOL',
};

interface StakeAccount {
  address: string;
  lamports: number;
  state: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat summary card
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
  colorClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  colorClass: string;
}) {
  return (
    <Card className={`border ${colorClass}`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-sm text-gray-600">{label}</span>
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main dashboard content (requires wallet context)
// ─────────────────────────────────────────────────────────────────────────────
function DashboardContent() {
  const { wallet } = useWallet();

  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [lpPositions, setLpPositions] = useState<any[]>([]);
  const [staking, setStaking] = useState<{
    accounts: StakeAccount[];
    totalStaked: number;
  } | null>(null);
  const [history, setHistory] = useState<ExecutionRecord[]>([]);
  const [workflowCount, setWorkflowCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!wallet?.address) return;
    setLoading(true);
    try {
      // 1. SOL Balance via Solana devnet RPC
      const { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl } =
        await import('@solana/web3.js');
      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
      const lamports = await connection.getBalance(new PublicKey(wallet.address));
      setSolBalance(lamports / LAMPORTS_PER_SOL);

      // 2. LP Positions from localStorage (synchronous)
      setLpPositions(getUserPositionsFromStorage(wallet.address));

      // 3. Marinade staking accounts
      try {
        const stakeRes = await fetch(`/api/marinade/accounts/${wallet.address}`);
        if (stakeRes.ok) {
          const stakeData = await stakeRes.json();
          setStaking({
            accounts: stakeData.accounts || [],
            totalStaked: stakeData.totalStaked || 0,
          });
        }
      } catch {
        // staking endpoint optional — swallow network errors silently
      }

      // 4. Saved workflow count
      try {
        const wfRes = await fetch('/api/workflows');
        if (wfRes.ok) {
          const wfData = await wfRes.json();
          setWorkflowCount(Array.isArray(wfData) ? wfData.length : 0);
        }
      } catch {
        // optional
      }
    } catch (err) {
      console.error('[Dashboard] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [wallet?.address]);

  // Execution history — sync from in-memory store, also react to live updates
  useEffect(() => {
    const update = () => setHistory(getExecutionHistory());
    update();
    window.addEventListener('execution-history-updated', update);
    return () => window.removeEventListener('execution-history-updated', update);
  }, []);

  // Load async data whenever wallet changes
  useEffect(() => {
    if (wallet?.address) loadData();
  }, [wallet?.address, loadData]);

  const totalLpValue = lpPositions.reduce((sum, p) => sum + (p.valueUSD || 0), 0);

  // ── Not connected ────────────────────────────────────────────────────────
  if (!wallet?.isConnected) {
    return (
      <div className="container mx-auto py-12 px-4 max-w-lg">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Connect your wallet to view your portfolio dashboard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // ── Connected ────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto py-8 px-4">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Portfolio Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Your DeFi activity on{' '}
            <span className="font-medium text-blue-600">Solana Devnet</span>
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* ── Summary stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Wallet className="h-5 w-5 text-blue-600" />}
          label="SOL Balance"
          value={solBalance !== null ? `${solBalance.toFixed(4)} SOL` : '—'}
          sub="Solana Devnet"
          colorClass="bg-blue-50 border-blue-100"
        />
        <StatCard
          icon={<Droplets className="h-5 w-5 text-purple-600" />}
          label="LP Portfolio"
          value={`$${totalLpValue.toFixed(2)}`}
          sub={`${lpPositions.length} position${lpPositions.length !== 1 ? 's' : ''}`}
          colorClass="bg-purple-50 border-purple-100"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          label="Total Staked"
          value={staking ? `${staking.totalStaked.toFixed(4)} SOL` : '—'}
          sub={
            staking
              ? `${staking.accounts.length} account${staking.accounts.length !== 1 ? 's' : ''}`
              : 'Loading...'
          }
          colorClass="bg-green-50 border-green-100"
        />
        <StatCard
          icon={<Activity className="h-5 w-5 text-orange-600" />}
          label="Workflows Run"
          value={history.length.toString()}
          sub={`${workflowCount} saved`}
          colorClass="bg-orange-50 border-orange-100"
        />
      </div>

      {/* ── LP Positions + Staking (two columns) ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* LP Positions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Droplets className="h-5 w-5 text-purple-600" />
              Liquidity Positions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lpPositions.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <Droplets className="h-10 w-10 mx-auto mb-2 opacity-25" />
                <p className="font-medium">No LP positions found</p>
                <p className="text-xs mt-1">
                  Add liquidity via a workflow to see positions here
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pool</TableHead>
                    <TableHead className="text-right">LP Tokens</TableHead>
                    <TableHead className="text-right">Share %</TableHead>
                    <TableHead className="text-right">Value (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lpPositions.map((pos, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        {POOL_NAMES[pos.poolAddress] ??
                          `${pos.poolAddress.slice(0, 8)}…`}
                      </TableCell>
                      <TableCell className="text-right">
                        {pos.lpBalance.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right">
                        {pos.sharePercentage.toFixed(4)}%
                      </TableCell>
                      <TableCell className="text-right">
                        ${pos.valueUSD.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Marinade Staking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Marinade Staking
            </CardTitle>
          </CardHeader>
          <CardContent>
            {staking && staking.accounts.length > 0 ? (
              <>
                <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Staked</p>
                  <p className="text-2xl font-bold text-green-700">
                    {staking.totalStaked.toFixed(4)} SOL
                  </p>
                </div>
                <div className="space-y-2">
                  {staking.accounts.map((acc, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded border text-sm"
                    >
                      <span className="font-mono text-xs text-gray-600">
                        {acc.address.slice(0, 8)}…{acc.address.slice(-6)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {(acc.lamports / 1e9).toFixed(4)} SOL
                        </span>
                        <Badge
                          variant={acc.state === 'active' ? 'default' : 'secondary'}
                          className={`text-xs ${acc.state === 'active' ? 'bg-green-100 text-green-800' : ''}`}
                        >
                          {acc.state}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-10 text-gray-500">
                <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-25" />
                <p className="font-medium">No active stake accounts</p>
                <p className="text-xs mt-1">
                  Stake SOL via a workflow to see staking info here
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Execution History (full width) ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-blue-600" />
            Recent Workflow Executions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <History className="h-10 w-10 mx-auto mb-2 opacity-25" />
              <p className="font-medium">No workflow runs yet</p>
              <p className="text-xs mt-1">
                Execute a workflow on the Builder to see history here
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Steps</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead>On-chain Txs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((record) => {
                    const signatures = record.actions
                      .filter((a) => a.signature)
                      .map((a) => ({ sig: a.signature!, type: a.type }));

                    return (
                      <TableRow key={record.id}>
                        <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                          {new Date(record.timestamp).toLocaleTimeString()}
                          <br />
                          {new Date(record.timestamp).toLocaleDateString()}
                        </TableCell>

                        <TableCell className="font-medium whitespace-nowrap">
                          {record.workflowName}
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={
                              record.status === 'success'
                                ? 'default'
                                : record.status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                            }
                            className={
                              record.status === 'success'
                                ? 'bg-green-100 text-green-800'
                                : ''
                            }
                          >
                            {record.status}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {record.actions.map((action, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className={`text-xs capitalize ${
                                  action.status === 'success'
                                    ? 'border-green-300 text-green-700'
                                    : action.status === 'failed'
                                    ? 'border-red-300 text-red-700'
                                    : ''
                                }`}
                              >
                                {action.type}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>

                        <TableCell className="text-right text-xs text-gray-500 whitespace-nowrap">
                          {record.totalDuration
                            ? `${(record.totalDuration / 1000).toFixed(1)}s`
                            : '—'}
                        </TableCell>

                        <TableCell>
                          {signatures.length === 0 ? (
                            <span className="text-xs text-gray-400">mock only</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {signatures.map(({ sig, type }, i) => (
                                <a
                                  key={i}
                                  href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline whitespace-nowrap"
                                >
                                  {type}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page wrapper (own WalletProvider + consistent header)
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  return (
    <WalletProvider>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-6">
              <div className="flex items-center">
                <Layout className="h-6 w-6 text-blue-600 mr-2" />
                <span className="text-xl font-semibold text-gray-900">
                  DEX WorkflowVerse
                </span>
              </div>
              <nav className="hidden md:flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (window.location.href = '/')}
                >
                  Builder
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (window.location.href = '/workflows')}
                >
                  Workflows
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (window.location.href = '/visual')}
                >
                  Visual
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 font-semibold"
                  disabled
                >
                  Dashboard
                </Button>
              </nav>
            </div>
            <WalletConnector />
          </div>
        </header>
        <main>
          <DashboardContent />
        </main>
      </div>
    </WalletProvider>
  );
}
