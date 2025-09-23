import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
// import { useWorkflow } from "@/hooks/use-workflow";
import { useToast } from "@/hooks/use-toast";

type ModuleType = "swap" | "jupiterSwap" | "stake" | "claim" | "bridge" | "lightning";

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

export function ConfigPanel() {
  const selectedNode = (window as any).selectedWorkflowNode;
  const updateNodeData = (nodeId: string, data: any) => {
    if (!selectedNode) return;
    const event = new CustomEvent('updateNodeData', { 
      detail: { nodeId, data } 
    });
    window.dispatchEvent(event);
  };
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);
  
  // State for different module configurations
  const [swapConfig, setSwapConfig] = useState<SwapConfig>({
    moduleName: "Swap BTC to sBTC",
    sourceToken: "BTC",
    targetToken: "sBTC",
    amount: "0.5",
    slippage: "1",
    useBestRoute: true,
  });
  
  const [stakeConfig, setStakeConfig] = useState<StakeConfig>({
    moduleName: "Stake sBTC",
    asset: "sBTC",
    pool: "Yield Farm",
    lockPeriod: "30",
    autoCompound: true,
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
    recipient: "lightning@example.com",
    amount: "0.01",
    memo: "Payment for services",
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
          moduleName: "Swap BTC to sBTC",
          sourceToken: "BTC",
          targetToken: "sBTC",
          amount: "0.5",
          slippage: "1",
          useBestRoute: true,
        });
        break;
      case "stake":
        setStakeConfig({
          moduleName: "Stake sBTC",
          asset: "sBTC",
          pool: "Yield Farm",
          lockPeriod: "30",
          autoCompound: true,
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
          recipient: "lightning@example.com",
          amount: "0.01",
          memo: "Payment for services",
        });
        break;
    }
  };

  if (!isOpen) {
    return (
      <div className="flex flex-col items-center justify-center w-12 bg-dark-200 border-l border-dark-100">
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
      <div className="w-80 bg-dark-200 overflow-y-auto flex-shrink-0 border-l border-dark-100 hidden lg:block">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Configuration</h2>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              <span className="material-icons">close</span>
            </Button>
          </div>
          
          <div className="flex flex-col items-center justify-center h-[60vh] text-center p-4">
            <span className="material-icons text-4xl text-gray-400 mb-4">settings</span>
            <h3 className="text-lg font-medium mb-2">No Module Selected</h3>
            <p className="text-gray-400 text-sm">
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
              <Label className="text-xs text-gray-400">Module Name</Label>
              <Input 
                value={swapConfig.moduleName} 
                onChange={(e) => setSwapConfig({...swapConfig, moduleName: e.target.value})}
                className="mt-1 bg-dark-300 border-dark-100"
              />
            </div>
            
            <div>
              <Label className="text-xs text-gray-400">Source Token</Label>
              <Select 
                value={swapConfig.sourceToken}
                onValueChange={(value) => setSwapConfig({...swapConfig, sourceToken: value})}
              >
                <SelectTrigger className="mt-1 bg-dark-300 border-dark-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BTC">BTC</SelectItem>
                  <SelectItem value="ETH">ETH</SelectItem>
                  <SelectItem value="USDC">USDC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-xs text-gray-400">Target Token</Label>
              <Select 
                value={swapConfig.targetToken}
                onValueChange={(value) => setSwapConfig({...swapConfig, targetToken: value})}
              >
                <SelectTrigger className="mt-1 bg-dark-300 border-dark-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sBTC">sBTC</SelectItem>
                  <SelectItem value="USDT">USDT</SelectItem>
                  <SelectItem value="DAI">DAI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-xs text-gray-400">Amount</Label>
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
              <Label className="text-xs text-gray-400">Slippage Tolerance</Label>
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
            
            <Card className="bg-dark-100 p-3 text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-gray-400">Estimated Output:</span>
                <span>≈ {(parseFloat(swapConfig.amount) * 0.996).toFixed(3)} {swapConfig.targetToken}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Fee:</span>
                <span>{(parseFloat(swapConfig.amount) * 0.004).toFixed(3)} {swapConfig.sourceToken}</span>
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
            <h3 className="text-base font-medium">Stake Configuration</h3>
          </div>
          
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-400">Module Name</Label>
              <Input 
                value={stakeConfig.moduleName} 
                onChange={(e) => setStakeConfig({...stakeConfig, moduleName: e.target.value})}
                className="mt-1 bg-dark-300 border-dark-100"
              />
            </div>
            
            <div>
              <Label className="text-xs text-gray-400">Asset</Label>
              <Select 
                value={stakeConfig.asset}
                onValueChange={(value) => setStakeConfig({...stakeConfig, asset: value})}
              >
                <SelectTrigger className="mt-1 bg-dark-300 border-dark-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sBTC">sBTC</SelectItem>
                  <SelectItem value="BTC">BTC</SelectItem>
                  <SelectItem value="ETH">ETH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-xs text-gray-400">Pool</Label>
              <Select 
                value={stakeConfig.pool}
                onValueChange={(value) => setStakeConfig({...stakeConfig, pool: value})}
              >
                <SelectTrigger className="mt-1 bg-dark-300 border-dark-100">
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
              <Label className="text-xs text-gray-400">Lock Period (days)</Label>
              <Input 
                type="number" 
                value={stakeConfig.lockPeriod} 
                onChange={(e) => setStakeConfig({...stakeConfig, lockPeriod: e.target.value})}
                className="mt-1 bg-dark-300 border-dark-100"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="autoCompound" 
                checked={stakeConfig.autoCompound}
                onCheckedChange={(checked) => setStakeConfig({...stakeConfig, autoCompound: checked as boolean})}
              />
              <Label htmlFor="autoCompound">Auto-compound rewards</Label>
            </div>
            
            <Card className="bg-dark-100 p-3 text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-gray-400">Est. APY:</span>
                <span>12.5%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Rewards Token:</span>
                <span>YIELD</span>
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
              <Label className="text-xs text-gray-400">Module Name</Label>
              <Input 
                value={claimConfig.moduleName} 
                onChange={(e) => setClaimConfig({...claimConfig, moduleName: e.target.value})}
                className="mt-1 bg-dark-300 border-dark-100"
              />
            </div>
            
            <div>
              <Label className="text-xs text-gray-400">From Pool</Label>
              <Select 
                value={claimConfig.fromPool}
                onValueChange={(value) => setClaimConfig({...claimConfig, fromPool: value})}
              >
                <SelectTrigger className="mt-1 bg-dark-300 border-dark-100">
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
              <Label className="text-xs text-gray-400">Token</Label>
              <Select 
                value={claimConfig.token}
                onValueChange={(value) => setClaimConfig({...claimConfig, token: value})}
              >
                <SelectTrigger className="mt-1 bg-dark-300 border-dark-100">
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
            
            <Card className="bg-dark-100 p-3 text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-gray-400">Est. Claimable:</span>
                <span>250 YIELD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Value:</span>
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
              <Label className="text-xs text-gray-400">Module Name</Label>
              <Input 
                value={bridgeConfig.moduleName} 
                onChange={(e) => setBridgeConfig({...bridgeConfig, moduleName: e.target.value})}
                className="mt-1 bg-dark-300 border-dark-100"
              />
            </div>
            
            <div>
              <Label className="text-xs text-gray-400">Source Chain</Label>
              <Select 
                value={bridgeConfig.sourceChain}
                onValueChange={(value) => setBridgeConfig({...bridgeConfig, sourceChain: value})}
              >
                <SelectTrigger className="mt-1 bg-dark-300 border-dark-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bitcoin">Bitcoin</SelectItem>
                  <SelectItem value="Ethereum">Ethereum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-xs text-gray-400">Target Chain</Label>
              <Select 
                value={bridgeConfig.targetChain}
                onValueChange={(value) => setBridgeConfig({...bridgeConfig, targetChain: value})}
              >
                <SelectTrigger className="mt-1 bg-dark-300 border-dark-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sBTC Network">sBTC Network</SelectItem>
                  <SelectItem value="sBTC Testnet">sBTC Testnet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-xs text-gray-400">Amount</Label>
              <Input 
                type="text" 
                value={bridgeConfig.amount} 
                onChange={(e) => setBridgeConfig({...bridgeConfig, amount: e.target.value})}
                className="mt-1 bg-dark-300 border-dark-100"
              />
            </div>
            
            <Card className="bg-dark-100 p-3 text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-gray-400">Est. Bridging Time:</span>
                <span>~60 minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Fee:</span>
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
              <Label className="text-xs text-gray-400">Module Name</Label>
              <Input 
                value={lightningConfig.moduleName} 
                onChange={(e) => setLightningConfig({...lightningConfig, moduleName: e.target.value})}
                className="mt-1 bg-dark-300 border-dark-100"
              />
            </div>
            
            <div>
              <Label className="text-xs text-gray-400">Recipient</Label>
              <Input 
                value={lightningConfig.recipient} 
                onChange={(e) => setLightningConfig({...lightningConfig, recipient: e.target.value})}
                className="mt-1 bg-dark-300 border-dark-100"
              />
            </div>
            
            <div>
              <Label className="text-xs text-gray-400">Amount</Label>
              <Input 
                type="text" 
                value={lightningConfig.amount} 
                onChange={(e) => setLightningConfig({...lightningConfig, amount: e.target.value})}
                className="mt-1 bg-dark-300 border-dark-100"
              />
            </div>
            
            <div>
              <Label className="text-xs text-gray-400">Memo</Label>
              <Input 
                value={lightningConfig.memo} 
                onChange={(e) => setLightningConfig({...lightningConfig, memo: e.target.value})}
                className="mt-1 bg-dark-300 border-dark-100"
              />
            </div>
            
            <Card className="bg-dark-100 p-3 text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-gray-400">Speed:</span>
                <span>Instant</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Fee:</span>
                <span>~1 sat</span>
              </div>
            </Card>
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
            className="bg-dark-100 hover:bg-dark-300"
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
