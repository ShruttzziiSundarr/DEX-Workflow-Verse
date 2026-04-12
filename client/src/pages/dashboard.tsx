import React, { useState, useEffect, useCallback } from 'react';
import { OperationManual } from '@/components/OperationManual';
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
  AlertCircle,
  Timer,
  BookOpen,
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
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
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

  // Cumulative time comparison
  const TRAD_SECONDS: Record<string, number> = {
    swap: 180, jupiterSwap: 180, addLiquidity: 600, removeLiquidity: 480,
    liquidityPool: 540, stake: 900, claim: 300, bridge: 2700, lightning: 420,
  };
  const totalTraditionalSeconds = history.reduce((sum, record) => {
    return sum + record.actions
      .filter(a => a.status === 'success')
      .reduce((s, a) => s + (TRAD_SECONDS[a.type] ?? 120), 0);
  }, 0);
  const totalDexMs = history.reduce((sum, r) => sum + (r.totalDuration ?? 0), 0);
  const totalSavedSeconds = Math.max(0, totalTraditionalSeconds - totalDexMs / 1000);
  const savedPercent = totalTraditionalSeconds > 0 ? Math.round((totalSavedSeconds / totalTraditionalSeconds) * 100) : 0;
  function fmtSaved(sec: number) {
    if (sec < 60) return `${Math.round(sec)}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    return `${(sec / 3600).toFixed(1)}h`;
  }

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
          <p className="text-muted-foreground mt-1">
            Your DeFi activity on{' '}
            <span className="font-medium text-blue-400">Solana Devnet</span>
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* ── Summary stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          icon={<Wallet className="h-5 w-5 text-blue-600" />}
          label="SOL Balance"
          value={solBalance !== null ? `${solBalance.toFixed(4)} SOL` : '—'}
          sub="Solana Devnet"
          colorClass="bg-blue-500/10 border-blue-500/20"
        />
        <StatCard
          icon={<Droplets className="h-5 w-5 text-purple-500" />}
          label="LP Portfolio"
          value={`$${totalLpValue.toFixed(2)}`}
          sub={`${lpPositions.length} position${lpPositions.length !== 1 ? 's' : ''}`}
          colorClass="bg-purple-500/10 border-purple-500/20"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-green-500" />}
          label="Total Staked"
          value={staking ? `${staking.totalStaked.toFixed(4)} SOL` : '—'}
          sub={
            staking
              ? `${staking.accounts.length} account${staking.accounts.length !== 1 ? 's' : ''}`
              : 'Loading...'
          }
          colorClass="bg-green-500/10 border-green-500/20"
        />
        <StatCard
          icon={<Activity className="h-5 w-5 text-orange-500" />}
          label="Workflows Run"
          value={history.length.toString()}
          sub={`${workflowCount} saved`}
          colorClass="bg-orange-500/10 border-orange-500/20"
        />
        <StatCard
          icon={<Timer className="h-5 w-5 text-teal-500" />}
          label="Time Saved"
          value={history.length === 0 ? '—' : fmtSaved(totalSavedSeconds)}
          sub={history.length === 0 ? 'Run a workflow to see' : `${savedPercent}% vs manual ops`}
          colorClass="bg-teal-500/10 border-teal-500/20"
        />
      </div>

      {/* ── Automation Impact ─────────────────────────────────────────────── */}
      {history.length > 0 && (
        <Card className="mb-6 border-teal-500/20 bg-teal-500/5">
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-teal-500/20 rounded-full">
                  <Timer className="h-6 w-6 text-teal-400" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Automation Impact</p>
                  <p className="text-sm text-muted-foreground">
                    DEX WorkflowVerse saved you <strong className="text-teal-400">{fmtSaved(totalSavedSeconds)}</strong> across{' '}
                    {history.length} execution{history.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-8 text-center">
                <div>
                  <p className="text-2xl font-bold text-red-400">{fmtSaved(totalTraditionalSeconds)}</p>
                  <p className="text-xs text-muted-foreground">Manual estimate</p>
                </div>
                <div className="text-muted-foreground text-xl">→</div>
                <div>
                  <p className="text-2xl font-bold text-green-400">{totalDexMs < 1000 ? `${totalDexMs}ms` : `${(totalDexMs / 1000).toFixed(1)}s`}</p>
                  <p className="text-xs text-muted-foreground">WorkflowVerse</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-teal-400">{savedPercent}%</p>
                  <p className="text-xs text-muted-foreground">Faster</p>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24">Manual</span>
                <div className="flex-1 h-3 bg-red-500/20 rounded-full">
                  <div className="h-full bg-red-400 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24">WorkflowVerse</span>
                <div className="flex-1 h-3 bg-green-500/20 rounded-full">
                  <div
                    className="h-full bg-green-400 rounded-full"
                    style={{ width: `${Math.max(1, 100 - savedPercent)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
              <div className="text-center py-10 text-muted-foreground">
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
                <div className="mb-4 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Staked</p>
                  <p className="text-2xl font-bold text-green-400">
                    {staking.totalStaked.toFixed(4)} SOL
                  </p>
                </div>
                <div className="space-y-2">
                  {staking.accounts.map((acc, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 bg-muted rounded border border-border text-sm"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {acc.address.slice(0, 8)}…{acc.address.slice(-6)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {(acc.lamports / 1e9).toFixed(4)} SOL
                        </span>
                        <Badge
                          variant={acc.state === 'active' ? 'default' : 'secondary'}
                          className={`text-xs ${acc.state === 'active' ? 'bg-green-500/20 text-green-400' : ''}`}
                        >
                          {acc.state}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
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
            <div className="text-center py-10 text-muted-foreground">
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
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
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
                                ? 'bg-green-500/20 text-green-400 border-green-500/30'
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
                                    ? 'border-green-500/40 text-green-400'
                                    : action.status === 'failed'
                                    ? 'border-red-500/40 text-red-400'
                                    : ''
                                }`}
                              >
                                {action.type}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>

                        <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                          {record.totalDuration
                            ? `${(record.totalDuration / 1000).toFixed(1)}s`
                            : '—'}
                        </TableCell>

                        <TableCell>
                          {signatures.length === 0 ? (
                            <span className="text-xs text-muted-foreground">mock only</span>
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
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSelectedType, setManualSelectedType] = useState<string | undefined>();

  // Listen for open-operation-manual events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setManualSelectedType(typeof detail === 'string' ? detail : undefined);
      setManualOpen(true);
    };
    window.addEventListener('open-operation-manual', handler);
    return () => window.removeEventListener('open-operation-manual', handler);
  }, []);

  return (
    <WalletProvider>
      <div className="min-h-screen bg-background text-foreground">
        <header className="bg-card border-b border-border">
          <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-6">
              <a href="/" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
                <span className="text-primary text-xl font-bold tracking-tight">DEX</span>
                <span className="text-foreground text-xl font-light tracking-tight">WorkflowVerse</span>
              </a>
              <nav className="hidden md:flex gap-1">
                <a href="/"><Button variant="ghost" size="sm">Builder</Button></a>
                <a href="/workflows"><Button variant="ghost" size="sm">Workflows</Button></a>
                <a href="/visual"><Button variant="ghost" size="sm">Visual</Button></a>
                <Button variant="ghost" size="sm" className="text-primary font-semibold" disabled>
                  Dashboard
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setManualOpen(true)}
                >
                  <BookOpen className="h-4 w-4 mr-1" />
                  Help
                </Button>
              </nav>
            </div>
            <WalletConnector />
          </div>
        </header>
        <main>
          <DashboardContent />
        </main>

        {/* Operation Manual Dialog */}
        <OperationManual
          open={manualOpen}
          onClose={() => setManualOpen(false)}
          selectedType={manualSelectedType}
        />
      </div>
    </WalletProvider>
  );
}
