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

type CommonConfig = {
  moduleName: string;
};

type SwapConfig = CommonConfig & {
  sourceToken: string;
  targetToken: string;
  amount: string;
  slippage: string;
  useBestRoute: boolean;
};

type StakeConfig = CommonConfig & {
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

type LightningConfig = CommonConfig & {
  recipient: string;
  amount: string;
  memo: string;
};

type LiquidityPoolConfig = CommonConfig & {
  action: 'addLiquidity' | 'removeLiquidity';
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  lpTokenAmount: string;
  slippage: string;
};

export function ConfigPanel() {
  const selectedNode = (window as any).selectedWorkflowNode;
  const { updateNodeData } = useWorkflow();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);
  
  // State for different module configurations
  const [swapConfig, setSwapConfig] = useState<SwapConfig>({
    moduleName: "Swap SOL to USDC",
    sourceToken: "SOL",
    targetToken: "USDC",
    amount: "1.0",
    slippage: "1",
    useBestRoute: true,
  });
  
  const [stakeConfig, setStakeConfig] = useState<StakeConfig>({
    moduleName: "Stake SOL",
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

  const [lpConfig, setLpConfig] = useState<LiquidityPoolConfig>({
    moduleName: "Add Liquidity",
    action: "addLiquidity",
    tokenA: "SOL",
    tokenB: "USDC",
    amountA: "1.0",
    amountB: "150.0",
    lpTokenAmount: "0",
    slippage: "1",
  });

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
        case "lightning":
          setLightningConfig(prev => ({
            ...prev,
            moduleName: currentData.label || "Lightning Payment",
            ...currentData.config
          }));
          break;
        case "liquidityPool":
        case "addLiquidity":
        case "removeLiquidity":
          setLpConfig(prev => ({
            ...prev,
            moduleName: currentData.label || "Add Liquidity",
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
      case "swap":
        newData = {
          ...newData,
          label: swapConfig.moduleName,
          config: { ...swapConfig }
        };
        break;
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
      case "lightning":
        newData = {
          ...newData,
          label: lightningConfig.moduleName,
          config: { ...lightningConfig }
        };
        break;
      case "liquidityPool":
      case "addLiquidity":
      case "removeLiquidity":
        newData = {
          ...newData,
          label: lpConfig.moduleName,
          config: { ...lpConfig }
        };
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
      case "lightning":
        setLightningConfig({
          moduleName: "Lightning Payment",
          recipient: "",
          amount: "0.01",
          memo: "Payment for services",
        });
        break;
      case "liquidityPool":
      case "addLiquidity":
      case "removeLiquidity":
        setLpConfig({
          moduleName: "Add Liquidity",
          action: "addLiquidity",
          tokenA: "SOL",
          tokenB: "USDC",
          amountA: "1.0",
          amountB: "150.0",
          lpTokenAmount: "0",
          slippage: "1",
        });
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
              <Label className="text-xs text-muted-foreground">Source Token</Label>
              <Select
                value={swapConfig.sourceToken}
                onValueChange={(value) => setSwapConfig({...swapConfig, sourceToken: value})}
              >
                <SelectTrigger className="mt-1 bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOL">SOL</SelectItem>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="USDT">USDT</SelectItem>
                  <SelectItem value="BONK">BONK</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Target Token</Label>
              <Select
                value={swapConfig.targetToken}
                onValueChange={(value) => setSwapConfig({...swapConfig, targetToken: value})}
              >
                <SelectTrigger className="mt-1 bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="USDT">USDT</SelectItem>
                  <SelectItem value="SOL">SOL</SelectItem>
                  <SelectItem value="BONK">BONK</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-xs text-muted-foreground">Amount</Label>
              <div className="flex mt-1">
                <Input 
                  type="text" 
                  value={swapConfig.amount} 
                  onChange={(e) => setSwapConfig({...swapConfig, amount: e.target.value})}
                  className="rounded-r-none bg-dark-300 border-dark-100"
                />
                <Select
                  value={swapConfig.sourceToken}
                  onValueChange={(value) => setSwapConfig({...swapConfig, sourceToken: value})}
                >
                  <SelectTrigger className="rounded-l-none min-w-[80px] bg-dark-300 border-dark-100 border-l-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BTC">BTC</SelectItem>
                    <SelectItem value="Max">Max</SelectItem>
                  </SelectContent>
                </Select>
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
            
            <Card className="bg-muted p-3 text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Est. Claimable:</span>
                <span>250 YIELD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Value:</span>
                <span>~0.025 BTC</span>
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
              <Label className="text-xs text-muted-foreground">Action</Label>
              <Select
                value={lpConfig.action}
                onValueChange={(value: 'addLiquidity' | 'removeLiquidity') => setLpConfig({...lpConfig, action: value})}
              >
                <SelectTrigger className="mt-1 bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="addLiquidity">Add Liquidity</SelectItem>
                  <SelectItem value="removeLiquidity">Remove Liquidity</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Token A</Label>
                <Select
                  value={lpConfig.tokenA}
                  onValueChange={(value) => setLpConfig({...lpConfig, tokenA: value})}
                >
                  <SelectTrigger className="mt-1 bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SOL">SOL</SelectItem>
                    <SelectItem value="RAY">RAY</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Token B</Label>
                <Select
                  value={lpConfig.tokenB}
                  onValueChange={(value) => setLpConfig({...lpConfig, tokenB: value})}
                >
                  <SelectTrigger className="mt-1 bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="USDT">USDT</SelectItem>
                    <SelectItem value="SOL">SOL</SelectItem>
                  </SelectContent>
                </Select>
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
