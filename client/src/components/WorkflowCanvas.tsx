import { useState, useCallback, useRef, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  EdgeChange,
  NodeChange,
  NodeTypes,
  Node,
  ReactFlowProvider,
  ReactFlowInstance,
  MarkerType,
} from 'reactflow';
import { useWallet } from "@/hooks/use-wallet";
import 'reactflow/dist/style.css';
import { Button } from "@/components/ui/button";
import { WorkflowNode } from './modules/WorkflowNode';
import { ModuleType } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useWorkflow } from '@/hooks/use-workflow';
import { Card } from '@/components/ui/card';
import { jupiterSwap, addLiquidity } from '@/lib/solana/jupiterSwap';
import { getTokenByAddress } from '@/lib/solana/tokenList';
import { ExecutionHistory, addExecutionRecord, type ExecutionRecord } from './ExecutionHistory';

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode,
};

const INITIAL_VIEWPORT = { x: 0, y: 0, zoom: 1 };

export function WorkflowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const { nodes, setNodes, edges, setEdges, selectedNode, setSelectedNode } = useWorkflow();
  const { toast } = useToast();
  const { wallet, connectWallet, disconnectWallet, isConnecting } = useWallet();
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Wallet validity is polled centrally in the WalletProvider; components can read
  // `walletValid` and `isCheckingWallet` from the provider if needed.



  // Connect / Disconnect helpers for UI
  const handleConnectWallet = async () => {
    try {
      const provider: any = (window as any)?.solana;
      if (provider && provider.connect) {
        const resp = await provider.connect();
        const addr = resp?.publicKey?.toString?.() || provider.publicKey?.toString?.();
        await connectWallet(addr);
      } else {
        toast({ title: 'Wallet Not Found', description: 'Please install Phantom wallet', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error('Error connecting wallet from UI:', err);
      toast({ title: 'Connect Failed', description: String(err?.message || err), variant: 'destructive' });
    }
  };

  const handleDisconnectWallet = async () => {
    try {
      await disconnectWallet();
      const provider: any = (window as any)?.solana;
      if (provider && provider.disconnect) {
        try { await provider.disconnect(); } catch (e) { /* ignore */ }
      }
    } catch (err: any) {
      console.error('Error disconnecting wallet from UI:', err);
      toast({ title: 'Disconnect Failed', description: String(err?.message || err), variant: 'destructive' });
    }
  };

  const onNodesChange = useCallback((changes: any) => {
    setNodes((nds) => {
      const updatedNodes = [...nds];
      changes.forEach((change: any) => {
        if (change.type === 'select') {
          const nodeIndex = updatedNodes.findIndex(n => n.id === change.id);
          if (nodeIndex !== -1) {
            const node = updatedNodes[nodeIndex];
            setSelectedNode(change.selected ? node : null);
            // Update global workflow context if needed
            (window as any).selectedWorkflowNode = change.selected ? node : null;
          }
        }
      });
      return updatedNodes;
    });
  }, [setNodes]);

  const onEdgesChange = useCallback((changes: any) => {
    setEdges((eds) => eds);
  }, [setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({
      ...connection,
      type: 'smoothstep',
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
      style: { 
        stroke: 'rgba(255, 255, 255, 0.5)',
        strokeWidth: 2
      }
    }, eds)),
    [setEdges]
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const moduleType = event.dataTransfer.getData('application/reactflow') as ModuleType;
      if (!moduleType) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${moduleType}-${Date.now()}`,
        type: 'workflowNode',
        position,
        data: { type: moduleType, label: getModuleLabel(moduleType) },
        draggable: true,
      };

      setNodes((nds) => nds.concat(newNode));
      setSelectedNode(newNode);
    },
    [reactFlowInstance, setNodes, setSelectedNode]
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleNew = () => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    toast({
      title: 'New Workflow',
      description: 'Started a new workflow',
    });
  };

  const handleClear = () => {
    if (nodes.length > 0 && confirm('Are you sure you want to clear the current workflow?')) {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
      toast({
        title: 'Workflow Cleared',
        description: 'All nodes and connections have been removed',
      });
    }
  };

  const handleValidate = () => {
    // Basic validation
    if (nodes.length === 0) {
      toast({
        title: 'Validation Failed',
        description: 'Workflow is empty. Add some modules to continue.',
        variant: 'destructive',
      });
      return;
    }

    // Check for disconnected nodes
    const connectedNodeIds = new Set<string>();
    
    edges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });
    
    // If there's only one node, it doesn't need connections
    if (nodes.length > 1) {
      const disconnectedNodes = nodes.filter(node => !connectedNodeIds.has(node.id));
      
      if (disconnectedNodes.length > 0) {
        toast({
          title: 'Validation Failed',
          description: `There are ${disconnectedNodes.length} disconnected modules. Connect all modules to create a valid workflow.`,
          variant: 'destructive',
        });
        return;
      }
    }

    toast({
      title: 'Validation Successful',
      description: 'Workflow is valid and ready to execute',
      variant: 'default',
    });
  };

  const handleExecute = async () => {
    // Prevent double execution
    if (isExecuting) {
      console.log('Execution already in progress, ignoring duplicate call');
      return;
    }

    setIsExecuting(true);

    // Start tracking execution for history
    const executionStartTime = Date.now();
    const executionActions: ExecutionRecord['actions'] = [];
    const executionId = `exec-${Date.now()}`;

    try {
      // Check wallet connection first
      if (!wallet?.isConnected) {
        toast({
          title: 'Wallet Not Connected',
          description: 'Please connect your wallet to execute the workflow.',
          variant: 'destructive',
        });
        return;
      }

      // Validate workflow
      if (nodes.length === 0) {
        toast({
          title: 'Cannot Execute',
          description: 'Workflow is empty. Add some modules to continue.',
          variant: 'destructive',
        });
        return;
      }

      // Check for disconnected nodes
      const connectedNodeIds = new Set<string>();

      edges.forEach(edge => {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
      });

      // If there's only one node, it doesn't need connections
      if (nodes.length > 1) {
        const disconnectedNodes = nodes.filter(node => !connectedNodeIds.has(node.id));

        if (disconnectedNodes.length > 0) {
          toast({
            title: 'Cannot Execute',
            description: `There are ${disconnectedNodes.length} disconnected modules. Connect all modules to create a valid workflow.`,
            variant: 'destructive',
          });
          return;
        }
      }

      // Execute workflow actions in sequence
      // Phantom must be connected on Devnet
      const provider: any = (window as any).solana;
      if (!provider?.isPhantom) {
        toast({ title: 'Phantom Required', description: 'Install/Connect Phantom on Devnet.', variant: 'destructive' });
        return;
      }

      // Ensure provider is connected and has a publicKey
      if (!provider.publicKey) {
        await provider.connect();
      }

      const userPublicKey = provider.publicKey.toString();

      // Find and execute Swap if present (supports both 'swap' and 'jupiterSwap' types)
      const swapNode = nodes.find(n => n.data?.type === 'swap' || n.data?.type === 'jupiterSwap');
      if (swapNode) {
        const cfg = (swapNode.data?.config || {}) as any;

        // Get token symbols from config (support both old mint-based and new symbol-based config)
        const sourceToken = cfg.sourceToken || cfg.inputSymbol || 'SOL';
        const targetToken = cfg.targetToken || cfg.outputSymbol || 'USDC';

        // Map token symbols to devnet mints
        const TOKEN_TO_MINT: Record<string, string> = {
          'SOL': 'So11111111111111111111111111111111111111112',
          'USDC': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
          'USDT': 'EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS',
          'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        };

        const TOKEN_DECIMALS: Record<string, number> = {
          'SOL': 9,
          'USDC': 6,
          'USDT': 6,
          'BONK': 5,
        };

        const inputMint = cfg.inputToken || TOKEN_TO_MINT[sourceToken] || TOKEN_TO_MINT['SOL'];
        const outputMint = cfg.outputToken || TOKEN_TO_MINT[targetToken] || TOKEN_TO_MINT['USDC'];

        const uiAmount = parseFloat(cfg.amount || '1.0');
        const slippageBps = parseInt(cfg.slippageBps || String(parseFloat(cfg.slippage || '1') * 100));

        const inputDecimals = TOKEN_DECIMALS[sourceToken] || 9;
        const outputDecimals = TOKEN_DECIMALS[targetToken] || 6;

        toast({ title: 'Executing Swap...', description: `Swapping ${uiAmount} ${sourceToken} -> ${targetToken} (devnet mock)` });

        try {
          const result = await jupiterSwap({
            inputMint,
            outputMint,
            uiAmount,
            inputDecimals,
            outputDecimals,
            slippageBps,
            userPublicKey,
            destinationWallet: userPublicKey,
            cluster: 'devnet',
          });

          toast({
            title: 'Swap Completed',
            description: result.message || `Swapped ${uiAmount} ${sourceToken} for ~${result.outputAmount?.toFixed(4) || '?'} ${targetToken}`,
          });

          console.log('[Swap] Result:', result);

          // Record swap action in history
          executionActions.push({
            type: 'swap',
            status: 'success',
            message: `Swapped ${uiAmount} ${sourceToken} for ~${result.outputAmount?.toFixed(4) || '?'} ${targetToken}`,
            signature: result.signature,
            details: {
              inputToken: sourceToken,
              outputToken: targetToken,
              inputAmount: uiAmount,
              outputAmount: result.outputAmount?.toFixed(4),
              mode: result.mode,
            },
          });
        } catch (swapError: any) {
          console.error('Swap execution error:', swapError);
          toast({
            title: 'Swap Failed',
            description: swapError.message || 'Unknown error during swap',
            variant: 'destructive',
          });

          // Record failed swap action
          executionActions.push({
            type: 'swap',
            status: 'failed',
            message: swapError.message || 'Unknown error during swap',
          });
          return;
        }
      }

      // Find and execute Add Liquidity if present (supports multiple LP types)
      const liquidityNode = nodes.find(n =>
        n.data?.type === 'addLiquidity' ||
        n.data?.type === 'liquidityPool' ||
        n.data?.type === 'removeLiquidity'
      );
      if (liquidityNode) {
        const cfg = (liquidityNode.data?.config || {}) as any;
        const nodeType = liquidityNode.data?.type;

        // Determine action based on node type or config
        const lpAction = cfg.action || (nodeType === 'removeLiquidity' ? 'removeLiquidity' : 'addLiquidity');

        // Get token symbols (support both symbol-based and mint-based config)
        const tokenA = cfg.tokenA || 'SOL';
        const tokenB = cfg.tokenB || 'USDC';
        const amountA = parseFloat(cfg.amountA || '1.0');
        const amountB = parseFloat(cfg.amountB || '150.0');
        const lpTokenAmount = parseFloat(cfg.lpTokenAmount || '10');
        const slippage = parseFloat(cfg.slippage || '1');

        try {
          // Import the LP module
          const { handleLiquidityPool } = await import('../lib/solana/liquidityPool');

          if (lpAction === 'addLiquidity') {
            toast({ title: 'Adding Liquidity...', description: `Adding ${amountA} ${tokenA} + ${amountB} ${tokenB} to pool (devnet mock)` });

            const result = await handleLiquidityPool({
              action: 'addLiquidity',
              tokenA,
              tokenB,
              amountA,
              amountB,
              slippage,
              fromPubkey: new PublicKey(userPublicKey),
            });

            toast({
              title: 'Liquidity Added',
              description: result.message || `Received ${result.lpTokensReceived?.toFixed(4)} LP tokens`,
            });
          } else {
            toast({ title: 'Removing Liquidity...', description: `Removing ${lpTokenAmount} LP tokens from ${tokenA}/${tokenB} pool (devnet mock)` });

            const result = await handleLiquidityPool({
              action: 'removeLiquidity',
              tokenA,
              tokenB,
              lpTokenAmount,
              slippage,
              fromPubkey: new PublicKey(userPublicKey),
            });

            toast({
              title: 'Liquidity Removed',
              description: result.message || `Received ${result.tokenAReceived?.toFixed(4)} ${tokenA} + ${result.tokenBReceived?.toFixed(4)} ${tokenB}`,
            });
          }
        } catch (lpError: any) {
          console.error('Liquidity operation error:', lpError);
          toast({
            title: 'Liquidity Operation Failed',
            description: lpError.message || 'Unknown error during liquidity operation',
            variant: 'destructive',
          });
          return;
        }
      }

      // Find and execute Marinade Staking if present
      const stakeNode = nodes.find(n => n.data?.type === 'stake');
      if (stakeNode) {
        const cfg = (stakeNode.data?.config || {}) as any;
        // Map actions: delegate -> stake, deactivate/withdraw -> unstake
        const originalAction = cfg.action || 'delegate';
        const marinadeAction = originalAction === 'delegate' ? 'stake' : 'unstake';
        
        // Robust amount parsing: accept number or string, default NaN if empty
        const rawAmount = cfg.amount;
        const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat((rawAmount ?? '').toString().trim());
        const validatorPubkey = cfg.validatorPubkey; // Get validator from config
        const stakeAccountPubkey = cfg.stakeAccountPubkey;
        
        if (marinadeAction === 'stake' && (Number.isNaN(amount) || amount <= 0)) {
          toast({ 
            title: 'Invalid Stake Configuration', 
            description: `Please provide a valid amount for staking. Current: ${Number.isNaN(amount) ? 'NaN' : amount}`, 
            variant: 'destructive' 
          });
          return;
        }
        
        if (marinadeAction === 'unstake' && !stakeAccountPubkey) {
          toast({ 
            title: 'Invalid Stake Configuration', 
            description: 'Please provide stake account for unstaking.', 
            variant: 'destructive' 
          });
          return;
        }

        toast({ 
          title: 'Executing Marinade Stake...', 
          description: `${marinadeAction === 'stake' ? 'Staking' : 'Unstaking'} ${marinadeAction === 'stake' ? amount : ''} SOL via Marinade (devnet)` 
        });
        
        try {
          // Use smart Marinade service (mocks on devnet, real on mainnet)
          const { handleMarinadeStake } = await import('../lib/solana/marinadeStaking');
          const signature = await handleMarinadeStake({
            action: marinadeAction,
            amount: marinadeAction === 'stake' ? amount : undefined,
            fromPubkey: new PublicKey(userPublicKey),
            stakeAccountPubkey: marinadeAction === 'unstake' ? stakeAccountPubkey : undefined,
          });

          toast({
            title: 'Marinade Stake Transaction Confirmed',
            description: `Signature: ${signature.slice(0, 8)}... View in explorer`,
          });

          // Record stake action in history
          executionActions.push({
            type: 'stake',
            status: 'success',
            message: `${marinadeAction === 'stake' ? 'Staked' : 'Unstaked'} ${marinadeAction === 'stake' ? amount : ''} SOL`,
            signature,
            details: {
              action: marinadeAction,
              amount: marinadeAction === 'stake' ? amount : undefined,
              validator: validatorPubkey || 'Auto-selected',
            },
          });
        } catch (error: any) {
          console.error('Marinade staking error:', error);
          toast({
            title: 'Execution Failed',
            description: error.message || 'Unexpected error',
            variant: 'destructive',
          });

          // Record failed stake action
          executionActions.push({
            type: 'stake',
            status: 'failed',
            message: error.message || 'Unexpected error',
          });
          return;
        }
      }

      // If no executable nodes found
      const hasExecutableNode = swapNode || liquidityNode || stakeNode;
      if (!hasExecutableNode) {
        toast({ title: 'No Executable Actions', description: 'Add Swap, Add Liquidity, or Stake modules to execute.', variant: 'destructive' });
        return;
      }

      // Show success message for workflow completion
      toast({
        title: 'Workflow Completed',
        description: 'All workflow actions have been executed successfully!',
      });

      // Record successful workflow execution in history
      const executionDuration = Date.now() - executionStartTime;
      addExecutionRecord({
        id: executionId,
        timestamp: new Date(),
        workflowName: `Workflow (${nodes.length} nodes)`,
        status: 'success',
        actions: executionActions,
        totalDuration: executionDuration,
      });

    } catch (err: any) {
      console.error(err);
      toast({ title: 'Execution Failed', description: String(err?.message || err), variant: 'destructive' });

      // Record failed workflow execution
      const executionDuration = Date.now() - executionStartTime;
      addExecutionRecord({
        id: executionId,
        timestamp: new Date(),
        workflowName: `Workflow (${nodes.length} nodes)`,
        status: 'failed',
        actions: executionActions,
        totalDuration: executionDuration,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex-1 bg-dark-300 overflow-hidden flex flex-col h-[calc(100vh-64px)]">
      <div className="border-b border-dark-100 p-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-sm font-medium">My Workflow</h2>
          <div className="flex items-center space-x-1 text-xs text-gray-400">
            <span className="material-icons text-xs">info</span>
            <span>Drag modules to canvas and connect them</span>
          </div>

          {/* Wallet connection status */}
          <div className="ml-2">
            {wallet?.isConnected ? (
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 bg-green-600 text-white rounded">
                  {wallet.address.substring(0, 6)}...{wallet.address.slice(-4)}
                </span>
                <button
                  onClick={handleDisconnectWallet}
                  className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectWallet}
                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>

          <div className="h-4 w-px bg-dark-100 mx-2"></div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleValidate}
              className="flex items-center gap-1 text-xs bg-purple-500 text-white hover:bg-purple-600"
            >
              <span className="material-icons text-xs">check_circle</span>
              <span>Validate</span>
            </Button>
            <Button
              size="sm"
              onClick={handleExecute}
              disabled={isExecuting}
              className="flex items-center gap-1 text-xs bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-icons text-xs">rocket_launch</span>
              <span>{isExecuting ? 'Executing...' : 'Execute'}</span>
            </Button>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" className="flex items-center gap-1 text-xs">
            <span className="material-icons text-xs">zoom_in</span>
          </Button>
          <Button variant="outline" size="sm" className="flex items-center gap-1 text-xs">
            <span className="material-icons text-xs">zoom_out</span>
          </Button>
          <Button variant="outline" size="sm" className="flex items-center gap-1 text-xs">
            <span className="material-icons text-xs">fit_screen</span>
          </Button>
        </div>
      </div>
      
  <div ref={reactFlowWrapper} className="flex-1 overflow-hidden relative" style={{ width: '100%', height: 'calc(100vh - 64px)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          defaultViewport={INITIAL_VIEWPORT}
          minZoom={0.2}
          maxZoom={4}
          fitView
          deleteKeyCode={["Backspace", "Delete"]}
          className="canvas-grid"
        >
          <Background color="rgba(255, 255, 255, 0.05)" gap={20} />
          <Controls />
          <MiniMap 
            nodeColor={(node) => {
              switch (node.data?.type) {
                case 'swap': return '#3165F5';
                case 'addLiquidity': return '#06B6D4';
                case 'stake': return '#10B981';
                case 'claim': return '#7C3AED';
                case 'bridge': return '#F59E0B';
                case 'lightning': return '#F59E0B';
                default: return '#888';
              }
            }}
            maskColor="rgba(0, 0, 0, 0.2)"
            className="bg-dark-200 border border-dark-100"
          />
        </ReactFlow>

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Card className="bg-dark-200/60 border border-dark-100 p-6 max-w-md text-center">
              <h3 className="text-lg font-medium mb-2">Empty Workflow</h3>
              <p className="text-gray-400 text-sm mb-4">
                Drag modules from the library panel to create your workflow
              </p>
              <span className="material-icons text-4xl text-gray-500">drag_indicator</span>
            </Card>
          </div>
        )}
      </div>
      
      <div className="border-t border-dark-100 p-4 flex items-center justify-between bg-white/5 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm" onClick={handleNew} className="flex items-center gap-2 text-sm hover:bg-gray-100">
            <span className="material-icons text-sm">add</span>
            <span>New</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear} className="flex items-center gap-2 text-sm hover:bg-gray-100">
            <span className="material-icons text-sm">delete</span>
            <span>Clear</span>
          </Button>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button 
            variant="outline" 
            size="default"
            onClick={handleValidate} 
            className="flex items-center gap-2 px-6 py-2 text-sm font-medium bg-purple-500 text-white hover:bg-purple-600 border-purple-600"
          >
            <span className="material-icons text-sm">check_circle</span>
            <span>Validate</span>
          </Button>
          <Button 
            size="default"
            onClick={handleExecute}
            disabled={isExecuting}
            className="flex items-center gap-2 px-6 py-2 text-sm font-medium bg-green-500 text-white hover:bg-green-600 border-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-icons text-sm">rocket_launch</span>
            <span>{isExecuting ? 'Executing...' : 'Execute'}</span>
          </Button>
        </div>
      </div>

      {/* Execution History Panel */}
      <ExecutionHistory />
    </div>
  );
}

function getModuleLabel(type: ModuleType): string {
  switch (type) {
    case 'swap': return 'Swap';
    case 'addLiquidity': return 'Add Liquidity';
    case 'stake': return 'Stake';
    case 'claim': return 'Claim Rewards';
    case 'bridge': return 'BTC Bridge';
    case 'lightning': return 'Lightning';
    default: return type;
  }
}

export function WorkflowCanvasWrapper() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvas />
    </ReactFlowProvider>
  );
}
