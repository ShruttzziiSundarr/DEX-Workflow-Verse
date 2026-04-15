import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { ValidatorSelector } from "@/components/ValidatorSelector";
import { useWorkflow } from "@/hooks/use-workflow";
import { useToast } from "@/hooks/use-toast";
import { ModuleType } from "@shared/schema";
import { estimateLPTokens, getUserPositionsFromStorage } from "@/lib/solana/liquidityPool";

const POOL_INFO: Record<string, { apr: number; fee: number }> = {
  'SOL/USDC': { apr: 24.5, fee: 0.25 },
  'SOL/USDT': { apr: 18.2, fee: 0.25 },
  'RAY/SOL': { apr: 32.1, fee: 0.25 },
  'USDC/SOL': { apr: 24.5, fee: 0.25 },
  'USDT/SOL': { apr: 18.2, fee: 0.25 },
  'SOL/RAY': { apr: 32.1, fee: 0.25 },
};

// Protocol-aware token options
const getTokenOptions = (protocol: string) => {
  const commonTokens = [
    { value: 'SOL', label: 'SOL', mint: 'So11111111111111111111111111111111111111112' },
    { value: 'USDC', label: 'USDC', mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' },
    { value: 'USDT', label: 'USDT', mint: 'EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS' },
    { value: 'CUSTOM', label: 'Custom Mint...', mint: '' },
  ];

  switch (protocol) {
    case 'raydium':
      return [
        ...commonTokens,
        { value: 'RAY', label: 'RAY', mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
        { value: 'BONK', label: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
      ];
    case 'orca':
      return [
        ...commonTokens,
        { value: 'ORCA', label: 'ORCA', mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE' },
      ];
    case 'jupiter':
    case 'sushiswap':
      return [
        ...commonTokens,
        { value: 'RAY', label: 'RAY', mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
        { value: 'BONK', label: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
        { value: 'ORCA', label: 'ORCA', mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE' },
      ];
    default:
      return commonTokens;
  }
};

type CommonConfig = {
  moduleName: string;
};

type SwapConfig = CommonConfig & {
  protocol: 'jupiter' | 'raydium' | 'orca' | 'sushiswap';
  sourceToken: string;
  sourceMint?: string; // For custom mint addresses
  targetToken: string;
  targetMint?: string; // For custom mint addresses
  amount: string;
  slippage: string;
  useBestRoute?: boolean;
  poolId?: string;
  poolAddress?: string;
};

type StakeConfig = CommonConfig & {
  protocol: 'native' | 'marinade';
  asset: string;
  pool: string;
  lockPeriod: string;
  autoCompound: boolean;
  // Solana-specific fields
  action: 'delegate' | 'deactivate' | 'withdraw';
  validatorPubkey?: string;
  stakeAccountPubkey?: string;
  amount: string;
};

type ClaimConfig = CommonConfig & {
  fromPool: string;
  token: string;
  autoReinvest: boolean;
};

type BridgeConfig = CommonConfig & {
  sourceChain: string;
  targetChain: string;
  amount: string;
};

type TransferConfig = CommonConfig & {
  recipient: string;
  amount: string;
  token: string;
  memo: string;
};

type LightningConfig = CommonConfig & {
  recipient: string;
  amount: string;
  memo: string;
};

type LiquidityPoolConfig = CommonConfig & {
  protocol: 'raydium' | 'orca';
  action: 'addLiquidity' | 'removeLiquidity' | 'createPool';
  tokenA: string;
  tokenAMint?: string;
  tokenB: string;
  tokenBMint?: string;
  amountA: string;
  amountB: string;
  lpTokenAmount: string;
  slippage: string;
  poolId?: string;
  poolAddress?: string;
};

type OrcaSwapConfig = CommonConfig & {
  sourceToken: string;
  sourceMint?: string;
  targetToken: string;
  targetMint?: string;
  amount: string;
  slippage: string;
  poolAddress: string;
};

type RaydiumSwapConfig = CommonConfig & {
  sourceToken: string;
  sourceMint?: string;
  targetToken: string;
  targetMint?: string;
  amount: string;
  slippage: string;
  poolId: string;
};

type TokenCreationConfig = CommonConfig & {
  symbol: string;
  decimals: string;
  initialSupply: string;
};

export function ConfigPanel() {
  const selectedNode = (window as any).selectedWorkflowNode;
  const { updateNodeData } = useWorkflow();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);
  
  // State for different module configurations
  const [swapConfig, setSwapConfig] = useState<SwapConfig>({
    moduleName: "Swap Tokens",
    protocol: "raydium",
    sourceToken: "SOL",
    targetToken: "USDC",
    amount: "1.0",
    slippage: "1",
    useBestRoute: true,
  });
  
  const [stakeConfig, setStakeConfig] = useState<StakeConfig>({
    moduleName: "Stake SOL",
    protocol: "native",
    asset: "SOL",
    pool: "Native Staking",
    lockPeriod: "30",
    autoCompound: true,
    action: "delegate",
    amount: "1.0",
  });
  
  const [claimConfig, setClaimConfig] = useState<ClaimConfig>({
    moduleName: "Claim Rewards",
    fromPool: "Yield Farm",
    token: "YIELD",
    autoReinvest: false,
  });
  
  const [bridgeConfig, setBridgeConfig] = useState<BridgeConfig>({
    moduleName: "Bridge BTC to sBTC",
    sourceChain: "Bitcoin",
    targetChain: "sBTC Network",
    amount: "0.1",
  });
  
  const [lightningConfig, setLightningConfig] = useState<LightningConfig>({
    moduleName: "Lightning Payment",
    recipient: "",
    amount: "0.01",
    memo: "Payment for services",
  });

  const [transferConfig, setTransferConfig] = useState<TransferConfig>({
    moduleName: "Transfer",
    recipient: "",
    amount: "0.1",
    token: "SOL",
    memo: "",
  });

  const [lpConfig, setLpConfig] = useState<LiquidityPoolConfig>({
    moduleName: "Liquidity Pool",
    protocol: "raydium",
    action: "addLiquidity",
    tokenA: "SOL",
    tokenB: "USDC",
    amountA: "1.0",
    amountB: "150.0",
    lpTokenAmount: "0",
    slippage: "1",
  });

  const [orcaSwapConfig, setOrcaSwapConfig] = useState<OrcaSwapConfig>({
    moduleName: "Orca Swap",
    sourceToken: "SOL",
    targetToken: "USDC",
    amount: "1.0",
    slippage: "1",
    poolAddress: "",
  });

  const [raydiumSwapConfig, setRaydiumSwapConfig] = useState<RaydiumSwapConfig>({
    moduleName: "Raydium Swap",
    sourceToken: "SOL",
    targetToken: "USDC",
    amount: "1.0",
    slippage: "1",
    poolId: "",
  });

  const [tokenCreationConfig, setTokenCreationConfig] = useState<TokenCreationConfig>({
    moduleName: "Create Token",
    symbol: "TKN",
    decimals: "6",
    initialSupply: "1000000",
  });

  // Dynamic preview state for Claim Rewards
  const [claimPreview, setClaimPreview] = useState<{summary: string, usd: number} | null>(null);

  // Fetch real LP claim previews dynamically
  useEffect(() => {
    if (selectedNode?.data?.type === 'claim') {
      const getPreview = async () => {
        try {
          const provider: any = (window as any)?.solana;
          if (provider?.publicKey) {
            const { previewClaimableRewards } = await import('@/lib/solana/claimRewards');
            const preview = previewClaimableRewards(provider.publicKey.toString());
            
            if (preview.results.length > 0) {
              const summary = preview.results
                .map(r => `${r.rewardA.toFixed(2)} ${r.tokenA} + ${r.rewardB.toFixed(2)} ${r.tokenB}`)
                .join(', ');
                
              setClaimPreview({ summary, usd: preview.totalRewardUSD });
            } else {
              setClaimPreview({ summary: '0.00 YIELD', usd: 0 });
            }
          }
        } catch (e) {
          console.error("Failed to fetch claim preview", e);
        }
      };
      getPreview();
      // Auto-refresh dynamic values every 3 seconds for demo purposes
      const interval = setInterval(getPreview, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedNode]);

  // Update form based on selected node
  useEffect(() => {
    if (selectedNode) {
      // Here we'd typically load the config from the selected node
      // For now, we'll just set the module name based on node type
      const type = selectedNode.data?.type as ModuleType;
      const currentData = selectedNode.data || {};
      
      switch (type) {
        case "swap":
          setSwapConfig(prev => ({
            ...prev,
            moduleName: currentData.label || "Swap BTC to sBTC",
            ...currentData.config
          }));
          break;
        case "stake":
          setStakeConfig(prev => ({
            ...prev,
            moduleName: currentData.label || "Stake sBTC",
            ...currentData.config
          }));
          break;
        case "claim":
          setClaimConfig(prev => ({
            ...prev,
            moduleName: currentData.label || "Claim Rewards",
            ...currentData.config
          }));
          break;
        case "bridge":
          setBridgeConfig(prev => ({
            ...prev,
            moduleName: currentData.label || "Bridge BTC to sBTC",
            ...currentData.config
          }));
          break;
        case "transfer":
          setTransferConfig(prev => ({
            ...prev,
            moduleName: currentData.label || "Transfer",
            ...currentData.config
          }));
          break;
        case "lightning":
          setLightningConfig(prev => ({
            ...prev,
            moduleName: currentData.label || "Lightning Payment",
            ...currentData.config
          }));
          break;
        case "liquidity":
        case "liquidityPool":
        case "addLiquidity":
        case "removeLiquidity":
          setLpConfig(prev => ({
            ...prev,
            moduleName: currentData.label || "Liquidity Pool",
            ...currentData.config
          }));
          break;
        case "orcaSwap":
          setOrcaSwapConfig(prev => ({
            ...prev,
            moduleName: currentData.label || "Orca Swap",
            ...currentData.config
          }));
          break;
        case "raydiumSwap":
          setRaydiumSwapConfig(prev => ({
            ...prev,
            moduleName: currentData.label || "Raydium Swap",
            ...currentData.config
          }));
          break;
        case "tokenCreation":
          setTokenCreationConfig(prev => ({
            ...prev,
            moduleName: currentData.label || "Create Token",
            ...currentData.config
          }));
          break;
      }
    }
  }, [selectedNode]);

  const handleApplyConfig = () => {
    if (!selectedNode) return;
    
    const type = selectedNode.data?.type as ModuleType;
    let newData = { ...selectedNode.data };
    
    switch (type) {
      case "swap": {
        newData = {
          ...newData,
          label: swapConfig.moduleName,
          config: { 
            ...swapConfig,
            sourceToken: swapConfig.sourceToken,
            targetToken: swapConfig.targetToken
          }
        };
        break;
      }
      case "stake":
        newData = {
          ...newData,
          label: stakeConfig.moduleName,
          config: { ...stakeConfig }
        };
        break;
      case "claim":
        newData = {
          ...newData,
          label: claimConfig.moduleName,
          config: { ...claimConfig }
        };
        break;
      case "bridge":
        newData = {
          ...newData,
          label: bridgeConfig.moduleName,
          config: { ...bridgeConfig }
        };
        break;
      case "transfer":
        newData = {
          ...newData,
          label: transferConfig.moduleName,
          config: { ...transferConfig }
        };
        break;
      case "lightning":
        newData = {
          ...newData,
          label: lightningConfig.moduleName,
          config: { ...lightningConfig }
        };
        break;
      case "liquidity":
      case "liquidityPool":
      case "addLiquidity":
      case "removeLiquidity": {
        const effectiveTokenA = lpConfig.tokenA === 'CUSTOM' ? (lpConfig.tokenAMint ?? '') : lpConfig.tokenA;
        const effectiveTokenB = lpConfig.tokenB === 'CUSTOM' ? (lpConfig.tokenBMint ?? '') : lpConfig.tokenB;
        newData = {
          ...newData,
          label: lpConfig.moduleName,
          config: { ...lpConfig, tokenA: effectiveTokenA, tokenB: effectiveTokenB }
        };
        break;
      }
      case "orcaSwap":
        newData = { ...newData, label: orcaSwapConfig.moduleName, config: { ...orcaSwapConfig } };
        break;
      case "raydiumSwap":
        newData = { ...newData, label: raydiumSwapConfig.moduleName, config: { ...raydiumSwapConfig } };
        break;
      case "tokenCreation":
        newData = { ...newData, label: tokenCreationConfig.moduleName, config: { ...tokenCreationConfig } };
        break;
    }

    updateNodeData(selectedNode.id, newData);
    toast({
      title: "Configuration Applied",
      description: "Module settings have been updated",
    });
  };

  const handleResetConfig = () => {
    if (!selectedNode) return;
    
    const type = selectedNode.data?.type as ModuleType;
    
    switch (type) {
      case "swap":
        setSwapConfig({
          moduleName: "Swap SOL to USDC",
          sourceToken: "SOL",
          targetToken: "USDC",
          amount: "1.0",
          slippage: "1",
          useBestRoute: true,
        });
        break;
      case "stake":
        setStakeConfig({
          moduleName: "Stake SOL",
          asset: "SOL",
          pool: "Native Staking",
          lockPeriod: "30",
          autoCompound: true,
          action: "delegate",
          amount: "1.0",
        });
        break;
      case "claim":
        setClaimConfig({
          moduleName: "Claim Rewards",
          fromPool: "Yield Farm",
          token: "YIELD",
          autoReinvest: false,
        });
        break;
      case "bridge":
        setBridgeConfig({
          moduleName: "Bridge BTC to sBTC",
          sourceChain: "Bitcoin",
          targetChain: "sBTC Network",
          amount: "0.1",
        });
        break;
      case "transfer":
        setTransferConfig({
          moduleName: "Transfer",
          recipient: "",
          amount: "0.1",
          token: "SOL",
          memo: "",
        });
        break;
      case "lightning":
        setLightningConfig({
          moduleName: "Lightning Payment",
          recipient: "",
          amount: "0.01",
          memo: "Payment for services",
        });
        break;
      case "liquidity":
      case "liquidityPool":
      case "addLiquidity":
      case "removeLiquidity":
        setLpConfig({
          moduleName: "Liquidity Pool",
          protocol: "raydium",
          action: "addLiquidity",
          tokenA: "SOL",
          tokenB: "USDC",
          amountA: "1.0",
          amountB: "150.0",
          lpTokenAmount: "0",
          slippage: "1",
        });
        break;
      case "orcaSwap":
        setOrcaSwapConfig({ moduleName: "Orca Swap", sourceToken: "SOL", targetToken: "USDC", amount: "1.0", slippage: "1", poolAddress: "" });
        break;
      case "raydiumSwap":
        setRaydiumSwapConfig({ moduleName: "Raydium Swap", sourceToken: "SOL", targetToken: "USDC", amount: "1.0", slippage: "1", poolId: "" });
        break;
      case "tokenCreation":
        setTokenCreationConfig({ moduleName: "Create Token", symbol: "TKN", decimals: "6", initialSupply: "1000000" });
        break;
    }
  };

  if (!isOpen) {
    return (
      <div className="flex flex-col items-center justify-center w-12 bg-card border-l border-border">
        <Button 
          variant="ghost" 
          size="sm" 
          className="mt-4" 
          onClick={() => setIsOpen(true)}
        >
          <span className="material-icons rotate-180">keyboard_double_arrow_right</span>
        </Button>
      </div>
    );
  }

  if (!selectedNode) {
    return (
      <div className="w-80 bg-card overflow-y-auto flex-shrink-0 border-l border-border hidden lg:block">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Configuration</h2>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              <span className="material-icons">close</span>
            </Button>
          </div>
          
          <div className="flex flex-col items-center justify-center h-[60vh] text-center p-4">
            <span className="material-icons text-4xl text-muted-foreground mb-4">settings</span>
            <h3 className="text-lg font-medium mb-2">No Module Selected</h3>
            <p className="text-muted-foreground text-sm">
              Select a module on the canvas to configure its settings
            </p>
          </div>
        </div>
      </div>
    );
  }

  const type = selectedNode.data?.type as ModuleType;
  let configContent;
  
  switch (type) {
    case "swap":
      configContent = (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary bg-opacity-20 flex items-center justify-center">
              <span className="material-icons text-primary">swap_horiz</span>
            </div>
            <h3 className="text-base font-medium">Swap Configuration</h3>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Module Name</Label>
              <Input
                value={swapConfig.moduleName}
                onChange={(e) => setSwapConfig({...swapConfig, moduleName: e.target.value})}
                className="mt-1 bg-background border-border"
              />
            </div>
            
            <div>
              <Label className="text-xs text-muted-foreground">Protocol</Label>
              <Select
                value={swapConfig.protocol}
                onValueChange={(value: 'jupiter' | 'raydium' | 'orca' | 'sushiswap') => {
                  // Reset tokens when protocol changes
                  setSwapConfig({
                    ...swapConfig, 
                    protocol: value,
                    sourceToken: 'SOL',
                    sourceMint: '',
                    targetToken: 'USDC', 
                    targetMint: '',
                    poolId: '',
                    poolAddress: ''
                  });
                }}
              >
                <SelectTrigger className="mt-1 bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raydium">Raydium CPMM (Devnet)</SelectItem>
                  <SelectItem value="orca">Orca Whirlpools</SelectItem>
                  <SelectItem value="jupiter">Jupiter (Mainnet)</SelectItem>
                  <SelectItem value="sushiswap">SushiSwap</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Source Token</Label>
              <Select
                value={swapConfig.sourceToken}
                onValueChange={(value) => setSwapConfig({...swapConfig, sourceToken: value, sourceMint: ''})}
              >
                <SelectTrigger className="mt-1 bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getTokenOptions(swapConfig.protocol).map(token => (
                    <SelectItem key={token.value} value={token.value}>
                      {token.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {swapConfig.sourceToken === 'CUSTOM' && (
                <Input
                  className="mt-1 bg-background border-border text-xs"
                  placeholder="Paste source mint address..."
                  value={swapConfig.sourceMint ?? ''}
                  onChange={(e) => setSwapConfig({...swapConfig, sourceMint: e.target.value})}
                />
              )}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Target Token</Label>
              <Select
                value={swapConfig.targetToken}
                onValueChange={(value) => setSwapConfig({...swapConfig, targetToken: value, targetMint: ''})}
              >
                <SelectTrigger className="mt-1 bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getTokenOptions(swapConfig.protocol).map(token => (
                    <SelectItem key={token.value} value={token.value}>
                      {token.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {swapConfig.targetToken === 'CUSTOM' && (
                <Input
                  className="mt-1 bg-background border-border text-xs"
                  placeholder="Paste target mint address..."
                  value={swapConfig.targetMint ?? ''}
                  onChange={(e) => setSwapConfig({...swapConfig, targetMint: e.target.value})}
                />
              )}
            </div>
            
            <div>
              <Label className="text-xs text-muted-foreground">Amount</Label>
              <div className="flex mt-1">
                <Input 
                  type="text" 
                  value={swapConfig.amount} 
                  onChange={(e) => setSwapConfig({...swapConfig, amount: e.target.value})}
                  className="rounded-r-none bg-background border-border"
                  placeholder="0.0"
                />
                <div className="flex items-center px-3 bg-muted border border-l-0 rounded-r-md text-xs">
                  {swapConfig.sourceToken === 'CUSTOM' ? 
                    (swapConfig.sourceMint ? `${swapConfig.sourceMint.slice(0, 4)}...${swapConfig.sourceMint.slice(-4)}` : 'CUSTOM') : 
                    swapConfig.sourceToken}
                </div>
              </div>
            </div>
            
            <div>
              <Label className="text-xs text-muted-foreground">Slippage Tolerance</Label>
              <div className="flex space-x-2 mt-1">
                <Button 
                  variant={swapConfig.slippage === "0.5" ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setSwapConfig({...swapConfig, slippage: "0.5"})}
                  className={swapConfig.slippage === "0.5" ? "bg-primary bg-opacity-10 border border-primary text-primary" : "bg-dark-300 border-dark-100"}
                >
                  0.5%
                </Button>
                <Button 
                  variant={swapConfig.slippage === "1" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setSwapConfig({...swapConfig, slippage: "1"})}
                  className={swapConfig.slippage === "1" ? "bg-primary bg-opacity-10 border border-primary text-primary" : "bg-dark-300 border-dark-100"}
                >
                  1%
                </Button>
                <Button 
                  variant={swapConfig.slippage === "3" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setSwapConfig({...swapConfig, slippage: "3"})}
                  className={swapConfig.slippage === "3" ? "bg-primary bg-opacity-10 border border-primary text-primary" : "bg-dark-300 border-dark-100"}
                >
                  3%
                </Button>
                <Input 
                  type="text" 
                  placeholder="Custom" 
                  value={!["0.5", "1", "3"].includes(swapConfig.slippage) ? swapConfig.slippage : ""}
                  onChange={(e) => setSwapConfig({...swapConfig, slippage: e.target.value})}
                  className="bg-dark-300 border-dark-100"
                />
              </div>
            </div>
            
            {(swapConfig.protocol === 'orca' || swapConfig.protocol === 'raydium') && (
              <div>
                <Label className="text-xs text-muted-foreground">
                  {swapConfig.protocol === 'orca' ? 'Whirlpool Address' : 'Pool ID'}
                </Label>
                <Input
                  className="mt-1 bg-background border-border text-xs"
                  placeholder={
                    swapConfig.protocol === 'orca'
                      ? '3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt (SOL/devUSDC)'
                      : 'Paste Raydium CPMM pool ID...'
                  }
                  value={swapConfig.protocol === 'orca' ? (swapConfig.poolAddress ?? '') : (swapConfig.poolId ?? '')}
                  onChange={(e) =>
                    swapConfig.protocol === 'orca'
                      ? setSwapConfig({...swapConfig, poolAddress: e.target.value})
                      : setSwapConfig({...swapConfig, poolId: e.target.value})
                  }
                />
                {swapConfig.protocol === 'orca' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Devnet pool: <span className="font-mono">3KBZiL2g8...HvPt</span> (SOL/devUSDC)
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="useBestRoute"
                checked={swapConfig.useBestRoute}
                onCheckedChange={(checked) => setSwapConfig({...swapConfig, useBestRoute: checked as boolean})}
              />
              <Label htmlFor="useBestRoute">Use best route</Label>
            </div>

            <Card className="bg-muted p-3 text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Estimated Output:</span>
                <span>≈ {(() => {
                  const prices: Record<string, number> = { SOL: 150, USDC: 1, USDT: 1, BONK: 0.00001 };
                  const rate = (prices[swapConfig.sourceToken] || 1) / (prices[swapConfig.targetToken] || 1);
                  const output = parseFloat(swapConfig.amount || '0') * rate * 0.997;
                  return output.toFixed(4);
                })()} {swapConfig.targetToken}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Fee:</span>
                <span>0.3%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network:</span>
                <span>Solana Devnet (Mock)</span>
              </div>
            </Card>
          </div>
        </div>
      );
      break;
      
    case "stake":
      configContent = (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-secondary bg-opacity-20 flex items-center justify-center">
              <span className="material-icons text-secondary">lock</span>
            </div>
            <h3 className="text-base font-medium">Solana Staking Configuration</h3>
          </div>
          
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Module Name</Label>
              <Input 
                value={stakeConfig.moduleName} 
                onChange={(e) => setStakeConfig({...stakeConfig, moduleName: e.target.value})}
                className="mt-1 bg-background border-border"
              />
            </div>
            
            <div>
              <Label className="text-xs text-muted-foreground">Protocol</Label>
              <Select 
                value={stakeConfig.protocol}
                onValueChange={(value: 'native' | 'marinade') => setStakeConfig({...stakeConfig, protocol: value})}
              >
                <SelectTrigger className="mt-1 bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="native">Native Staking</SelectItem>
                  <SelectItem value="marinade">Marinade (Liquid Staking)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-xs text-muted-foreground">Action</Label>
              <Select 
                value={stakeConfig.action}
                onValueChange={(value: 'delegate' | 'deactivate' | 'withdraw') => setStakeConfig({...stakeConfig, action: value})}
              >
                <SelectTrigger className="mt-1 bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delegate">Delegate (Stake)</SelectItem>
                  <SelectItem value="deactivate">Deactivate (Unstake)</SelectItem>
                  <SelectItem value="withdraw">Withdraw</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {stakeConfig.action === 'delegate' && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Amount (SOL)</Label>
                  <Input 
                    type="number" 
                    step="0.1"
                    value={stakeConfig.amount} 
                    onChange={(e) => setStakeConfig({...stakeConfig, amount: e.target.value})}
                    className="mt-1 bg-background border-border"
                    placeholder="1.0"
                  />
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground">Validator</Label>
                  <ValidatorSelector
                    selectedValidator={stakeConfig.validatorPubkey}
                    onValidatorSelect={(validatorPubkey) => setStakeConfig({...stakeConfig, validatorPubkey})}
                    placeholder="Select a validator"
                  />
                </div>
              </>
            )}
            
            {(stakeConfig.action === 'deactivate' || stakeConfig.action === 'withdraw') && (
              <div>
                <Label className="text-xs text-muted-foreground">Stake Account</Label>
                <Input 
                  value={stakeConfig.stakeAccountPubkey || ''} 
                  onChange={(e) => setStakeConfig({...stakeConfig, stakeAccountPubkey: e.target.value})}
                  className="mt-1 bg-background border-border"
                  placeholder="Stake account public key"
                />
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="autoCompound" 
                checked={stakeConfig.autoCompound}
                onCheckedChange={(checked) => setStakeConfig({...stakeConfig, autoCompound: checked as boolean})}
              />
              <Label htmlFor="autoCompound">Auto-compound rewards</Label>
            </div>
            
            <Card className="bg-muted p-3 text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Network:</span>
                <span>Solana Devnet</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. APY:</span>
                <span>6-8%</span>
              </div>
            </Card>
          </div>
        </div>
      );
      break;
      
    case "claim":
      configContent = (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#7C3AED] bg-opacity-20 flex items-center justify-center">
              <span className="material-icons text-[#7C3AED]">redeem</span>
            </div>
            <h3 className="text-base font-medium">Claim Rewards Configuration</h3>
          </div>
          
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Module Name</Label>
              <Input 
                value={claimConfig.moduleName} 
                onChange={(e) => setClaimConfig({...claimConfig, moduleName: e.target.value})}
                className="mt-1 bg-background border-border"
              />
            </div>
            
            <div>
              <Label className="text-xs text-muted-foreground">From Pool</Label>
              <Select 
                value={claimConfig.fromPool}
                onValueChange={(value) => setClaimConfig({...claimConfig, fromPool: value})}
              >
                <SelectTrigger className="mt-1 bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yield Farm">Yield Farm</SelectItem>
                  <SelectItem value="Liquidity Pool">Liquidity Pool</SelectItem>
                  <SelectItem value="Staking Rewards">Staking Rewards</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-xs text-muted-foreground">Token</Label>
              <Select 
                value={claimConfig.token}
                onValueChange={(value) => setClaimConfig({...claimConfig, token: value})}
              >
                <SelectTrigger className="mt-1 bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YIELD">YIELD</SelectItem>
                  <SelectItem value="LP-TOKEN">LP-TOKEN</SelectItem>
                  <SelectItem value="REWARD">REWARD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="autoReinvest" 
                checked={claimConfig.autoReinvest}
                onCheckedChange={(checked) => setClaimConfig({...claimConfig, autoReinvest: checked as boolean})}
              />
              <Label htmlFor="autoReinvest">Auto-reinvest rewards</Label>
            </div>
            
            <Card className="bg-muted p-3 text-xs border border-[rgba(124,58,237,0.2)]">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Est. Claimable:</span>
                <span className="font-mono text-[hsl(var(--primary))] font-medium text-right max-w-[200px] break-words">
                  {claimPreview ? claimPreview.summary : '0.00 YIELD'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">USD Value:</span>
                <span className="font-mono text-green-400 font-medium">
                  {claimPreview ? `$${claimPreview.usd.toFixed(2)}` : '$0.00'}
                </span>
              </div>
            </Card>
          </div>
        </div>
      );
      break;
      
    case "bridge":
      configContent = (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-yellow-500 bg-opacity-20 flex items-center justify-center">
              <span className="material-icons text-yellow-500">bridge</span>
            </div>
            <h3 className="text-base font-medium">Bridge Configuration</h3>
          </div>
          
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Module Name</Label>
              <Input 
                value={bridgeConfig.moduleName} 
                onChange={(e) => setBridgeConfig({...bridgeConfig, moduleName: e.target.value})}
                className="mt-1 bg-background border-border"
              />
            </div>
            
            <div>
              <Label className="text-xs text-muted-foreground">Source Chain</Label>
              <Select 
                value={bridgeConfig.sourceChain}
                onValueChange={(value) => setBridgeConfig({...bridgeConfig, sourceChain: value})}
              >
                <SelectTrigger className="mt-1 bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bitcoin">Bitcoin</SelectItem>
                  <SelectItem value="Ethereum">Ethereum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-xs text-muted-foreground">Target Chain</Label>
              <Select 
                value={bridgeConfig.targetChain}
                onValueChange={(value) => setBridgeConfig({...bridgeConfig, targetChain: value})}
              >
                <SelectTrigger className="mt-1 bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sBTC Network">sBTC Network</SelectItem>
                  <SelectItem value="sBTC Testnet">sBTC Testnet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-xs text-muted-foreground">Amount</Label>
              <Input 
                type="text" 
                value={bridgeConfig.amount} 
                onChange={(e) => setBridgeConfig({...bridgeConfig, amount: e.target.value})}
                className="mt-1 bg-background border-border"
              />
            </div>
            
            <Card className="bg-muted p-3 text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Est. Bridging Time:</span>
                <span>~60 minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee:</span>
                <span>0.001 BTC</span>
              </div>
            </Card>
          </div>
        </div>
      );
      break;
      
    case "lightning":
      configContent = (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-yellow-400 bg-opacity-20 flex items-center justify-center">
              <span className="material-icons text-yellow-400">bolt</span>
            </div>
            <h3 className="text-base font-medium">Lightning Configuration</h3>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Module Name</Label>
              <Input
                value={lightningConfig.moduleName}
                onChange={(e) => setLightningConfig({...lightningConfig, moduleName: e.target.value})}
                className="mt-1 bg-background border-border"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Recipient Wallet (Solana Address)</Label>
              <Input
                value={lightningConfig.recipient}
                onChange={(e) => setLightningConfig({...lightningConfig, recipient: e.target.value})}
                className="mt-1 bg-background border-border font-mono text-xs"
                placeholder="e.g. 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Amount (SOL)</Label>
              <Input
                type="text"
                value={lightningConfig.amount}
                onChange={(e) => setLightningConfig({...lightningConfig, amount: e.target.value})}
                className="mt-1 bg-background border-border"
                placeholder="e.g. 0.001"
              />
              {lightningConfig.amount && !isNaN(parseFloat(lightningConfig.amount)) && (
                <p className="text-xs text-muted-foreground mt-1">
                  ≈ {Math.floor(parseFloat(lightningConfig.amount) * 1_000_000_000).toLocaleString()} lamports
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Memo (optional)</Label>
              <Input
                value={lightningConfig.memo}
                onChange={(e) => setLightningConfig({...lightningConfig, memo: e.target.value})}
                className="mt-1 bg-background border-border"
                placeholder="Payment description"
              />
            </div>

            <Card className="bg-muted p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network:</span>
                <span>Solana Devnet</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Speed:</span>
                <span>Instant (~400ms)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span>SOL Transfer</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. Fee:</span>
                <span>~0.000005 SOL</span>
              </div>
            </Card>
          </div>
        </div>
      );
      break;

    case "liquidity":
    case "liquidityPool":
    case "addLiquidity":
    case "removeLiquidity":
      configContent = (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-cyan-500 bg-opacity-20 flex items-center justify-center">
              <span className="material-icons text-cyan-500">water_drop</span>
            </div>
            <h3 className="text-base font-medium">Liquidity Pool Configuration</h3>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Module Name</Label>
              <Input
                value={lpConfig.moduleName}
                onChange={(e) => setLpConfig({...lpConfig, moduleName: e.target.value})}
                className="mt-1 bg-background border-border"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Protocol</Label>
              <Select
                value={lpConfig.protocol}
                onValueChange={(value: 'raydium' | 'orca') => setLpConfig({...lpConfig, protocol: value})}
              >
                <SelectTrigger className="mt-1 bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raydium">Raydium Pools (CPMM)</SelectItem>
                  <SelectItem value="orca">Orca Whirlpools (CLMM)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Action</Label>
              <Select
                value={lpConfig.action}
                onValueChange={(value: 'addLiquidity' | 'removeLiquidity' | 'createPool') => setLpConfig({...lpConfig, action: value})}
              >
                <SelectTrigger className="mt-1 bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="addLiquidity">Add Liquidity</SelectItem>
                  <SelectItem value="removeLiquidity">Remove Liquidity</SelectItem>
                  <SelectItem value="createPool">Create New Pool</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Token A</Label>
                <Select
                  value={lpConfig.tokenA}
                  onValueChange={(value) => setLpConfig({...lpConfig, tokenA: value, tokenAMint: ''})}
                >
                  <SelectTrigger className="mt-1 bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SOL">SOL</SelectItem>
                    <SelectItem value="RAY">RAY</SelectItem>
                    <SelectItem value="CUSTOM">Custom Mint...</SelectItem>
                  </SelectContent>
                </Select>
                {lpConfig.tokenA === 'CUSTOM' && (
                  <Input
                    className="mt-1 bg-background border-border text-xs"
                    placeholder="Paste mint address..."
                    value={lpConfig.tokenAMint ?? ''}
                    onChange={(e) => setLpConfig({...lpConfig, tokenAMint: e.target.value})}
                  />
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Token B</Label>
                <Select
                  value={lpConfig.tokenB}
                  onValueChange={(value) => setLpConfig({...lpConfig, tokenB: value, tokenBMint: ''})}
                >
                  <SelectTrigger className="mt-1 bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="USDT">USDT</SelectItem>
                    <SelectItem value="SOL">SOL</SelectItem>
                    <SelectItem value="CUSTOM">Custom Mint...</SelectItem>
                  </SelectContent>
                </Select>
                {lpConfig.tokenB === 'CUSTOM' && (
                  <Input
                    className="mt-1 bg-background border-border text-xs"
                    placeholder="Paste mint address..."
                    value={lpConfig.tokenBMint ?? ''}
                    onChange={(e) => setLpConfig({...lpConfig, tokenBMint: e.target.value})}
                  />
                )}
              </div>
            </div>

            {lpConfig.action === 'addLiquidity' ? (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Amount {lpConfig.tokenA}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={lpConfig.amountA}
                    onChange={(e) => setLpConfig({...lpConfig, amountA: e.target.value})}
                    className="mt-1 bg-background border-border"
                    placeholder="0.0"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Amount {lpConfig.tokenB}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={lpConfig.amountB}
                    onChange={(e) => setLpConfig({...lpConfig, amountB: e.target.value})}
                    className="mt-1 bg-background border-border"
                    placeholder="0.0"
                  />
                </div>
              </>
            ) : (
              <div>
                <Label className="text-xs text-muted-foreground">LP Token Amount</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={lpConfig.lpTokenAmount}
                  onChange={(e) => setLpConfig({...lpConfig, lpTokenAmount: e.target.value})}
                  className="mt-1 bg-background border-border"
                  placeholder="0.0"
                />
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground">Slippage Tolerance</Label>
              <div className="flex space-x-2 mt-1">
                <Button
                  variant={lpConfig.slippage === "0.5" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLpConfig({...lpConfig, slippage: "0.5"})}
                  className={lpConfig.slippage === "0.5" ? "bg-primary bg-opacity-10 border border-primary text-primary" : "bg-dark-300 border-dark-100"}
                >
                  0.5%
                </Button>
                <Button
                  variant={lpConfig.slippage === "1" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLpConfig({...lpConfig, slippage: "1"})}
                  className={lpConfig.slippage === "1" ? "bg-primary bg-opacity-10 border border-primary text-primary" : "bg-dark-300 border-dark-100"}
                >
                  1%
                </Button>
                <Button
                  variant={lpConfig.slippage === "3" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLpConfig({...lpConfig, slippage: "3"})}
                  className={lpConfig.slippage === "3" ? "bg-primary bg-opacity-10 border border-primary text-primary" : "bg-dark-300 border-dark-100"}
                >
                  3%
                </Button>
              </div>
            </div>

            {lpConfig.action !== 'createPool' && (
              <div>
                <Label className="text-xs text-muted-foreground">Pool Address / ID (optional)</Label>
                <Input
                  className="mt-1 bg-background border-border text-xs"
                  placeholder="Paste Raydium pool ID or Orca whirlpool address"
                  value={lpConfig.poolAddress ?? ''}
                  onChange={(e) => setLpConfig({...lpConfig, poolAddress: e.target.value})}
                />
              </div>
            )}

            {(() => {
              const poolKey = `${lpConfig.tokenA}/${lpConfig.tokenB}`;
              const poolMeta = POOL_INFO[poolKey] || { apr: 0, fee: 0.25 };
              const lpEstimate = lpConfig.action === 'addLiquidity' &&
                lpConfig.amountA && lpConfig.amountB &&
                parseFloat(lpConfig.amountA) > 0 && parseFloat(lpConfig.amountB) > 0
                ? estimateLPTokens(parseFloat(lpConfig.amountA), parseFloat(lpConfig.amountB), lpConfig.tokenA, lpConfig.tokenB)
                : null;
              const walletStr = typeof window !== 'undefined' ? localStorage.getItem('wallet') : null;
              const walletAddress = walletStr ? JSON.parse(walletStr)?.address : null;
              const userPositions = walletAddress ? getUserPositionsFromStorage(walletAddress) : [];
              const userPosition = userPositions.find(p =>
                p.poolAddress.includes(lpConfig.tokenA) && p.poolAddress.includes(lpConfig.tokenB)
              ) || userPositions.find(p =>
                p.poolAddress === 'MockPool11111111111111111111111111111111111' && poolKey === 'SOL/USDC'
              ) || userPositions.find(p =>
                p.poolAddress === 'MockPool22222222222222222222222222222222222' && (poolKey === 'SOL/USDT' || poolKey === 'USDT/SOL')
              ) || userPositions.find(p =>
                p.poolAddress === 'MockPool33333333333333333333333333333333333' && (poolKey === 'RAY/SOL' || poolKey === 'SOL/RAY')
              );
              return (
                <Card className="bg-muted p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pool:</span>
                    <span className="font-medium">{lpConfig.tokenA}/{lpConfig.tokenB}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">APR:</span>
                    <span className="text-green-400">{poolMeta.apr > 0 ? `~${poolMeta.apr}%` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fee:</span>
                    <span>{poolMeta.fee}%</span>
                  </div>
                  {lpEstimate && (
                    <div className="flex justify-between border-t border-border pt-1 mt-1">
                      <span className="text-muted-foreground">Est. LP tokens:</span>
                      <span className="font-medium">{lpEstimate.lpTokens.toFixed(4)}</span>
                    </div>
                  )}
                  {lpEstimate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pool share:</span>
                      <span>{lpEstimate.sharePercent.toFixed(4)}%</span>
                    </div>
                  )}
                  {userPosition && (
                    <div className="flex justify-between border-t border-border pt-1 mt-1">
                      <span className="text-muted-foreground">Your LP balance:</span>
                      <span className="text-cyan-400 font-medium">{userPosition.lpBalance.toFixed(4)}</span>
                    </div>
                  )}
                  {userPosition && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Your share:</span>
                      <span>{userPosition.sharePercentage.toFixed(4)}%</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-1 mt-1">
                    <span className="text-muted-foreground">Network:</span>
                    <span>Solana Devnet</span>
                  </div>
                </Card>
              );
            })()}
          </div>
        </div>
      );
      break;

    case "orcaSwap":
      configContent = (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(6,214,160,0.2)" }}>
              <span className="material-icons" style={{ color: "#06D6A0" }}>waves</span>
            </div>
            <h3 className="text-base font-medium">Orca Swap Configuration</h3>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Module Name</Label>
              <Input value={orcaSwapConfig.moduleName} onChange={(e) => setOrcaSwapConfig({...orcaSwapConfig, moduleName: e.target.value})} className="mt-1 bg-background border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Source Token</Label>
              <Select value={orcaSwapConfig.sourceToken} onValueChange={(v) => setOrcaSwapConfig({...orcaSwapConfig, sourceToken: v, sourceMint: ''})}>
                <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOL">SOL</SelectItem>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="USDT">USDT</SelectItem>
                  <SelectItem value="BONK">BONK</SelectItem>
                  <SelectItem value="CUSTOM">Custom Mint...</SelectItem>
                </SelectContent>
              </Select>
              {orcaSwapConfig.sourceToken === 'CUSTOM' && (
                <Input
                  className="mt-1 bg-background border-border text-xs"
                  placeholder="Paste source mint address..."
                  value={orcaSwapConfig.sourceMint ?? ''}
                  onChange={(e) => setOrcaSwapConfig({...orcaSwapConfig, sourceMint: e.target.value})}
                />
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Target Token</Label>
              <Select value={orcaSwapConfig.targetToken} onValueChange={(v) => setOrcaSwapConfig({...orcaSwapConfig, targetToken: v, targetMint: ''})}>
                <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="USDT">USDT</SelectItem>
                  <SelectItem value="SOL">SOL</SelectItem>
                  <SelectItem value="BONK">BONK</SelectItem>
                  <SelectItem value="CUSTOM">Custom Mint...</SelectItem>
                </SelectContent>
              </Select>
              {orcaSwapConfig.targetToken === 'CUSTOM' && (
                <Input
                  className="mt-1 bg-background border-border text-xs"
                  placeholder="Paste target mint address..."
                  value={orcaSwapConfig.targetMint ?? ''}
                  onChange={(e) => setOrcaSwapConfig({...orcaSwapConfig, targetMint: e.target.value})}
                />
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Amount</Label>
              <Input type="text" value={orcaSwapConfig.amount} onChange={(e) => setOrcaSwapConfig({...orcaSwapConfig, amount: e.target.value})} className="mt-1 bg-background border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Slippage (%)</Label>
              <Input type="text" value={orcaSwapConfig.slippage} onChange={(e) => setOrcaSwapConfig({...orcaSwapConfig, slippage: e.target.value})} className="mt-1 bg-background border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Whirlpool Address (optional)</Label>
              <Input placeholder="Leave blank to auto-detect or use mock fallback" value={orcaSwapConfig.poolAddress} onChange={(e) => setOrcaSwapConfig({...orcaSwapConfig, poolAddress: e.target.value})} className="mt-1 bg-background border-border text-xs" />
            </div>
          </div>
        </div>
      );
      break;

    case "raydiumSwap":
      configContent = (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(95,69,255,0.2)" }}>
              <span className="material-icons" style={{ color: "#5F45FF" }}>hub</span>
            </div>
            <h3 className="text-base font-medium">Raydium Swap Configuration</h3>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Module Name</Label>
              <Input value={raydiumSwapConfig.moduleName} onChange={(e) => setRaydiumSwapConfig({...raydiumSwapConfig, moduleName: e.target.value})} className="mt-1 bg-background border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Source Token</Label>
              <Select value={raydiumSwapConfig.sourceToken} onValueChange={(v) => setRaydiumSwapConfig({...raydiumSwapConfig, sourceToken: v, sourceMint: ''})}>
                <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOL">SOL</SelectItem>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="USDT">USDT</SelectItem>
                  <SelectItem value="BONK">BONK</SelectItem>
                  <SelectItem value="CUSTOM">Custom Mint...</SelectItem>
                </SelectContent>
              </Select>
              {raydiumSwapConfig.sourceToken === 'CUSTOM' && (
                <Input
                  className="mt-1 bg-background border-border text-xs"
                  placeholder="Paste source mint address..."
                  value={raydiumSwapConfig.sourceMint ?? ''}
                  onChange={(e) => setRaydiumSwapConfig({...raydiumSwapConfig, sourceMint: e.target.value})}
                />
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Target Token</Label>
              <Select value={raydiumSwapConfig.targetToken} onValueChange={(v) => setRaydiumSwapConfig({...raydiumSwapConfig, targetToken: v, targetMint: ''})}>
                <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="USDT">USDT</SelectItem>
                  <SelectItem value="SOL">SOL</SelectItem>
                  <SelectItem value="BONK">BONK</SelectItem>
                  <SelectItem value="CUSTOM">Custom Mint...</SelectItem>
                </SelectContent>
              </Select>
              {raydiumSwapConfig.targetToken === 'CUSTOM' && (
                <Input
                  className="mt-1 bg-background border-border text-xs"
                  placeholder="Paste target mint address..."
                  value={raydiumSwapConfig.targetMint ?? ''}
                  onChange={(e) => setRaydiumSwapConfig({...raydiumSwapConfig, targetMint: e.target.value})}
                />
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Amount</Label>
              <Input type="text" value={raydiumSwapConfig.amount} onChange={(e) => setRaydiumSwapConfig({...raydiumSwapConfig, amount: e.target.value})} className="mt-1 bg-background border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Slippage (%)</Label>
              <Input type="text" value={raydiumSwapConfig.slippage} onChange={(e) => setRaydiumSwapConfig({...raydiumSwapConfig, slippage: e.target.value})} className="mt-1 bg-background border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Pool ID (optional)</Label>
              <Input placeholder="Leave blank to use registered CPMM pool" value={raydiumSwapConfig.poolId} onChange={(e) => setRaydiumSwapConfig({...raydiumSwapConfig, poolId: e.target.value})} className="mt-1 bg-background border-border text-xs" />
            </div>
          </div>
        </div>
      );
      break;

    case "tokenCreation":
      configContent = (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(249,115,22,0.2)" }}>
              <span className="material-icons" style={{ color: "#F97316" }}>toll</span>
            </div>
            <h3 className="text-base font-medium">Create Token Configuration</h3>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Module Name</Label>
              <Input value={tokenCreationConfig.moduleName} onChange={(e) => setTokenCreationConfig({...tokenCreationConfig, moduleName: e.target.value})} className="mt-1 bg-background border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Token Symbol</Label>
              <Input placeholder="e.g. TKN" value={tokenCreationConfig.symbol} onChange={(e) => setTokenCreationConfig({...tokenCreationConfig, symbol: e.target.value.toUpperCase().slice(0, 10)})} className="mt-1 bg-background border-border font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Decimals</Label>
              <Select value={tokenCreationConfig.decimals} onValueChange={(v) => setTokenCreationConfig({...tokenCreationConfig, decimals: v})}>
                <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 (whole units)</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="6">6 (like USDC)</SelectItem>
                  <SelectItem value="9">9 (like SOL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Initial Supply</Label>
              <Input type="text" placeholder="1000000" value={tokenCreationConfig.initialSupply} onChange={(e) => setTokenCreationConfig({...tokenCreationConfig, initialSupply: e.target.value})} className="mt-1 bg-background border-border" />
            </div>
            <div className="rounded-md bg-orange-500/10 border border-orange-500/30 p-3 text-xs text-orange-300">
              <span className="material-icons text-xs mr-1 align-middle">info</span>
              Creates a real SPL token on <strong>devnet</strong>. You will be the mint authority. Save the mint address from the execution log.
            </div>
          </div>
        </div>
      );
      break;

    default:
      configContent = <div>No configuration available for this module type</div>;
  }

  return (
    <div className="w-80 bg-dark-200 overflow-y-auto flex-shrink-0 border-l border-dark-100 hidden lg:block">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Configuration</h2>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            <span className="material-icons">close</span>
          </Button>
        </div>
        
        {configContent}
        
        <div className="pt-4 flex justify-end space-x-2">
          <Button 
            variant="outline" 
            onClick={handleResetConfig}
            className="bg-muted hover:bg-dark-300"
          >
            Reset
          </Button>
          <Button 
            onClick={handleApplyConfig}
            className="bg-primary hover:bg-blue-600"
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
