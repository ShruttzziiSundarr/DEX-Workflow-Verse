import React, { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { marketAnalyzer } from '@/lib/solana/market-analyzer';
import { getExecutionHistory } from '@/components/ExecutionHistory';
import { loadCustomPools } from '@/lib/solana/raydiumDevnet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { WalletConnector } from '@/components/WalletConnector';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import {
  Search,
  TrendingUp,
  Droplets,
  Layers,
  BarChart3,
  ShieldCheck,
  ExternalLink,
  ArrowUpRight,
  Zap,
  LayoutDashboard,
  Timer,
  BookOpen
} from 'lucide-react';

// Featured Devnet Pools
const FEATURED_POOLS = [
  { id: '1', name: 'SOL / USDC', address: '3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt', liquidity: '$1.2M', volume: '$240K', apr: '12.4%' },
  { id: '2', name: 'RAY / SOL', address: 'AVS98Rz29GaxKcyYis6Dsh9idWn75jSFE9U2S6kZid3E', liquidity: '$850K', volume: '$120K', apr: '18.2%' },
  { id: '3', name: 'USDT / SOL', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', liquidity: '$2.1M', volume: '$450K', apr: '8.5%' },
];

export default function ExplorePools() {
  const { wallet } = useWallet();
  const [activeTab, setActiveTab] = useState<'pools' | 'staking' | 'analytics'>('pools');
  const [searchTerm, setSearchTerm] = useState('');
  const [chartData, setChartData] = useState<any[]>([]);
  const [validatorStats, setValidatorStats] = useState<any>(null);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [customPools, setCustomPools] = useState<any[]>([]);
  const [networkPulse, setNetworkPulse] = useState<any>(null);

  useEffect(() => {
    // Initial data load
    setChartData(marketAnalyzer.getMarketTrendData('SOL/USDC'));
    setCustomPools(loadCustomPools());
    
    // Subscribe to real-time price feed for SOL/USDC
    marketAnalyzer.subscribeToPool('3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt', (update) => {
      setChartData(prev => {
        const newData = [...prev.slice(1), update];
        return newData;
      });
    });

    const loadStats = async () => {
      const stats = await marketAnalyzer.getValidatorInsights();
      setValidatorStats(stats);
      const history = getExecutionHistory();
      setPerformanceData(marketAnalyzer.calculatePnL(history));
      
      const pulse = await marketAnalyzer.getNetworkPulse();
      setNetworkPulse(pulse);
    };
    
    loadStats();
    const interval = setInterval(async () => {
      const pulse = await marketAnalyzer.getNetworkPulse();
      setNetworkPulse(pulse);
    }, 10000);

    return () => {
      marketAnalyzer.unsubscribeFromPool('3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt');
      clearInterval(interval);
    };
  }, []);

  const filteredPools = [...FEATURED_POOLS, ...customPools.map(p => ({
    id: p.poolId,
    name: `${p.symbolA} / ${p.symbolB}`,
    address: p.poolId,
    liquidity: 'New Pool',
    volume: '—',
    apr: 'N/A'
  }))].filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Premium Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <a href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">DEX <span className="font-light opacity-70">WorkflowVerse</span></span>
            </a>
            <nav className="hidden md:flex items-center gap-1">
              <a href="/"><Button variant="ghost" size="sm" className="text-white/60 hover:text-white">Builder</Button></a>
              <a href="/dashboard"><Button variant="ghost" size="sm" className="text-white/60 hover:text-white">Dashboard</Button></a>
              <Button variant="ghost" size="sm" className="bg-blue-600/10 text-blue-400 font-semibold border border-blue-600/20">Explore</Button>
              <a href="/workflows"><Button variant="ghost" size="sm" className="text-white/60 hover:text-white">Workflows</Button></a>
            </nav>
          </div>
          <WalletConnector />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Market Overview Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2 bg-black/40 border-white/5 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-2 right-2 flex items-center gap-2 px-2 py-1 rounded bg-blue-600/20 border border-blue-600/30">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">Live Stream</span>
            </div>
            
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2 text-white">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  Market Intelligence
                </CardTitle>
                <CardDescription className="text-white/50">Real-time SOL price activity on Devnet</CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">+4.2% (24h)</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="time" stroke="#ffffff30" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#ffffff30" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '8px' }}
                      itemStyle={{ color: '#3b82f6' }}
                    />
                    <Area type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="bg-black/40 border-white/5 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-white opacity-60">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Network Pulse
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-[10px] text-white/40 uppercase font-bold">Live TPS</p>
                    <p className="text-lg font-bold">{networkPulse?.tps || '...'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-[10px] text-white/40 uppercase font-bold">Congestion</p>
                    <p className={`text-lg font-bold ${networkPulse?.congestion === 'Low' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {networkPulse?.congestion || '...'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-[10px] text-white/30">
                  <div className={`w-1.5 h-1.5 rounded-full ${networkPulse?.status === 'Healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                  Cluster: Solana Devnet ({networkPulse?.status})
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-white/5 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2 text-white">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {performanceData.length === 0 ? (
                    <div className="text-center py-6 opacity-40">
                      <LayoutDashboard className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-[10px]">No workflow history</p>
                    </div>
                  ) : (
                    performanceData.slice(0, 3).map((record, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 text-xs">
                        <span className="opacity-70 truncate max-w-[100px]">{record.workflowName}</span>
                        <span className="text-green-400 font-bold">+{record.performance}</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Explore Hub Tabs */}
        <div className="flex gap-4 mb-6 border-b border-white/5">
          <button 
            onClick={() => setActiveTab('pools')}
            className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'pools' ? 'text-blue-400' : 'text-white/40 hover:text-white'}`}
          >
            <div className="flex items-center gap-2 px-2">
              <Droplets className="w-4 h-4" />
              Liquidity Pools
            </div>
            {activeTab === 'pools' && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-blue-400" />}
          </button>
          <button 
            onClick={() => setActiveTab('staking')}
            className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'staking' ? 'text-blue-400' : 'text-white/40 hover:text-white'}`}
          >
            <div className="flex items-center gap-2 px-2">
              <Layers className="w-4 h-4" />
              Advanced Staking (Helius)
            </div>
            {activeTab === 'staking' && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-blue-400" />}
          </button>
        </div>

        {/* Tab Content: Pools */}
        {activeTab === 'pools' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input 
                  placeholder="Search pairs (e.g. SOL/USDC)" 
                  className="pl-10 bg-black/40 border-white/10 focus:border-blue-500/50"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPools.map((pool) => (
                <Card key={pool.id} className="bg-black/40 border-white/5 hover:border-blue-500/30 transition-all hover:translate-y-[-2px] group overflow-hidden">
                  <div className="h-1 bg-blue-500/20 group-hover:bg-blue-500/50 transition-colors" />
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          <div className="w-8 h-8 rounded-full bg-blue-600 border-2 border-[#09090b] flex items-center justify-center text-[10px] font-bold">S</div>
                          <div className="w-8 h-8 rounded-full bg-purple-600 border-2 border-[#09090b] flex items-center justify-center text-[10px] font-bold">U</div>
                        </div>
                        <div>
                          <h3 className="font-bold text-white">{pool.name}</h3>
                          <p className="text-[10px] text-white/40 font-mono">{pool.address.slice(0, 10)}...</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-blue-500/20 text-blue-400">{pool.apr} APR</Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <p className="text-[10px] text-white/40 uppercase tracking-wider">Liquidity</p>
                        <p className="text-sm font-semibold">{pool.liquidity}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 uppercase tracking-wider">24h Volume</p>
                        <p className="text-sm font-semibold">{pool.volume}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="flex-1 bg-blue-600 hover:bg-blue-500 h-9"
                        onClick={() => window.location.href = `/?pool=${pool.address}&action=lp`}
                      >
                        <Zap className="w-3.5 h-3.5 mr-2" />
                        Build LP
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="w-9 h-9 p-0 border border-white/10"
                        onClick={() => window.open(`https://explorer.solana.com/address/${pool.address}?cluster=devnet`)}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content: Staking */}
        {activeTab === 'staking' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-black/40 border-white/5">
              <CardHeader>
                <div className="w-12 h-12 rounded-2xl bg-green-600/10 flex items-center justify-center mb-4">
                  <ShieldCheck className="w-6 h-6 text-green-400" />
                </div>
                <CardTitle className="text-xl font-bold">Validator Intelligence</CardTitle>
                <CardDescription className="text-white/40">Powered by Helius Staking APIs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-white/40">Network Validators</p>
                      <p className="text-2xl font-bold">{validatorStats?.validatorsCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-white/40">Avg APY</p>
                      <p className="text-2xl font-bold text-green-400">{validatorStats?.averageApy}%</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs text-white/30 uppercase font-bold tracking-widest">High Integrity Nodes (Pooled)</p>
                    {validatorStats?.pooledNodes.map((node: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <div>
                            <p className="text-sm font-semibold">{node.name}</p>
                            <p className="text-[10px] text-white/40">{node.delegators.toLocaleString()} users staking</p>
                          </div>
                        </div>
                        <p className="text-sm font-mono font-bold text-white/80">{node.stake}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="bg-blue-600/5 border-blue-600/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[60px] rounded-full" />
                <CardHeader>
                  <CardTitle className="text-xl font-bold">Why Pooled Staking?</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-white/60 leading-relaxed">
                  <p className="mb-4">Instead of staking on a single validator, "Pooled Staking" (like Marinade) spreads your SOL across hundreds of top-performing nodes. This maximizes security and ensures consistent yield even if one node goes offline.</p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-white/80">
                      <Zap className="w-4 h-4 text-blue-400" />
                      Instant liquidity (receive mSOL)
                    </li>
                    <li className="flex items-center gap-2 text-white/80">
                      <Zap className="w-4 h-4 text-blue-400" />
                      Automatic rebalancing for best yield
                    </li>
                  </ul>
                  <Button className="w-full mt-6 bg-blue-600 hover:bg-blue-500" onClick={() => window.location.href = '/?action=stake&protocol=marinade'}>
                    Start Liquid Staking
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-black/40 border-white/5">
                <CardHeader>
                  <CardTitle className="text-sm opacity-60 flex items-center gap-2">
                    <Timer className="w-4 h-4" />
                    Yield Projection
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] text-white/40 uppercase">Annual Yield (Est.)</p>
                      <p className="text-2xl font-bold">1.25 SOL</p>
                      <p className="text-[10px] text-green-400">Based on 100 SOL principal</p>
                    </div>
                    <Badge className="bg-white/10 text-white">Compound Interest ON</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="mt-12 py-8 border-t border-white/5 bg-black/40">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">© 2026 DEX WorkflowVerse. All market data provided by Helius & Raydium APIs on Solana Devnet.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-[10px] uppercase font-bold tracking-widest text-white/40 hover:text-white transition-colors">Documentation</a>
            <a href="#" className="text-[10px] uppercase font-bold tracking-widest text-white/40 hover:text-white transition-colors">Support</a>
            <a href="#" className="text-[10px] uppercase font-bold tracking-widest text-white/40 hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
