import { useState, useCallback, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
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
import { jupiterSwap } from '@/lib/solana/jupiterSwap';
import { ExecutionHistory, addExecutionRecord, type ExecutionRecord } from './ExecutionHistory';
import { TimeComparisonPanel } from './TimeComparisonPanel';
import { PresetWorkflows } from './PresetWorkflows';

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode,
};

const INITIAL_VIEWPORT = { x: 0, y: 0, zoom: 1 };

export function WorkflowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const { nodes, setNodes, edges, setEdges, setSelectedNode } = useWorkflow();
  const { toast } = useToast();
  const { wallet } = useWallet();
  const [isExecuting, setIsExecuting] = useState(false);
  const [showTimeComparison, setShowTimeComparison] = useState(false);
  const [lastComparisonData, setLastComparisonData] = useState<{
    actions: { type: string; status: 'success' | 'failed' | 'pending'; durationMs?: number }[];
    totalDurationMs: number;
    workflowName: string;
  } | null>(null);

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

  const onEdgesChange = useCallback((_changes: any) => {
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

  const setNodeExecStatus = useCallback((nodeId: string, status: 'idle' | 'running' | 'success' | 'failed') => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, executionStatus: status } } : n));
  }, [setNodes]);

  const handleExecute = async () => {
    // Prevent double execution
    if (isExecuting) {
      console.log('Execution already in progress, ignoring duplicate call');
      return;
    }

    setIsExecuting(true);

    // Reset all node statuses to idle
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, executionStatus: 'idle' } })));

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
          setNodeExecStatus(swapNode.id, 'running');
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
          setNodeExecStatus(swapNode.id, 'success');

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
          setNodeExecStatus(swapNode.id, 'failed');
          return;
        }
      }

      // Find and execute ALL liquidity nodes (addLiquidity / removeLiquidity / liquidityPool)
      const liquidityNodes = nodes.filter(n =>
        n.data?.type === 'addLiquidity' ||
        n.data?.type === 'liquidityPool' ||
        n.data?.type === 'removeLiquidity'
      );
      // keep backward-compat reference for hasExecutableNode check below
      const liquidityNode = liquidityNodes[0] ?? null;

      const { handleLiquidityPool } = await import('../lib/solana/liquidityPool');

      for (const lpNode of liquidityNodes) {
        const cfg = (lpNode.data?.config || {}) as any;
        const nodeType = lpNode.data?.type;
        const lpAction = cfg.action || (nodeType === 'removeLiquidity' ? 'removeLiquidity' : 'addLiquidity');
        const tokenA = cfg.tokenA || 'SOL';
        const tokenB = cfg.tokenB || 'USDC';
        const amountA = parseFloat(cfg.amountA || '1.0');
        const amountB = parseFloat(cfg.amountB || '150.0');
        const lpTokenAmount = parseFloat(cfg.lpTokenAmount || '10');
        const slippage = parseFloat(cfg.slippage || '1');

        try {
          if (lpAction === 'addLiquidity') {
            toast({ title: 'Adding Liquidity...', description: `${amountA} ${tokenA} + ${amountB} ${tokenB}` });
            setNodeExecStatus(lpNode.id, 'running');
            const result = await handleLiquidityPool({
              action: 'addLiquidity', tokenA, tokenB, amountA, amountB, slippage,
              fromPubkey: new PublicKey(userPublicKey),
            });
            toast({ title: 'Liquidity Added ✓', description: result.message });
            setNodeExecStatus(lpNode.id, 'success');
            executionActions.push({
              type: 'addLiquidity', status: 'success', message: result.message,
              signature: result.signature,
              details: { tokenA, tokenB, amountA, amountB, lpTokensReceived: result.lpTokensReceived, poolAddress: result.poolAddress, mode: result.mode },
            });
          } else {
            toast({ title: 'Removing Liquidity...', description: `${lpTokenAmount} LP tokens from ${tokenA}/${tokenB}` });
            setNodeExecStatus(lpNode.id, 'running');
            const result = await handleLiquidityPool({
              action: 'removeLiquidity', tokenA, tokenB, lpTokenAmount, slippage,
              fromPubkey: new PublicKey(userPublicKey),
            });
            toast({ title: 'Liquidity Removed ✓', description: result.message });
            setNodeExecStatus(lpNode.id, 'success');
            executionActions.push({
              type: 'removeLiquidity', status: 'success', message: result.message,
              signature: result.signature,
              details: { tokenA, tokenB, lpTokenAmount, tokenAReceived: result.tokenAReceived, tokenBReceived: result.tokenBReceived, poolAddress: result.poolAddress, mode: result.mode },
            });
          }
        } catch (lpError: any) {
          console.error('Liquidity operation error:', lpError);
          toast({ title: 'Liquidity Operation Failed', description: lpError.message || 'Unknown error', variant: 'destructive' });
          executionActions.push({ type: lpAction as any, status: 'failed', message: lpError.message || 'Unknown error' });
          setNodeExecStatus(lpNode.id, 'failed');
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
          setNodeExecStatus(stakeNode.id, 'running');
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
          setNodeExecStatus(stakeNode.id, 'success');

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
          setNodeExecStatus(stakeNode.id, 'failed');
          return;
        }
      }

      // Find and execute Instant SOL Transfer (Lightning module) if present
      const lightningNode = nodes.find(n => n.data?.type === 'lightning');
      if (lightningNode) {
        const cfg = (lightningNode.data?.config || {}) as any;
        const recipient = (cfg.recipient || '').trim();
        const amountSol = parseFloat(cfg.amount || '0');

        if (!recipient) {
          toast({ title: 'Missing Recipient', description: 'Please enter a Solana wallet address in the Lightning module config.', variant: 'destructive' });
          return;
        }
        // Validate it looks like a base58 Solana address before touching web3.js
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        if (!base58Regex.test(recipient)) {
          toast({ title: 'Invalid Solana Address', description: `"${recipient.slice(0, 20)}..." is not a valid Solana wallet address. Copy your address from Phantom.`, variant: 'destructive' });
          return;
        }
        if (isNaN(amountSol) || amountSol <= 0) {
          toast({ title: 'Invalid Transfer Amount', description: 'Please enter a valid SOL amount.', variant: 'destructive' });
          return;
        }

        toast({ title: 'Sending SOL Transfer...', description: `Sending ${amountSol} SOL to ${recipient.slice(0, 8)}...` });

        try {
          const { Connection, SystemProgram, Transaction, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl } = await import('@solana/web3.js');
          const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
          const fromPubkey = new PublicKey(userPublicKey);
          const toPubkey = new PublicKey(recipient);
          const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

          const latestBlockhash = await connection.getLatestBlockhash();
          const tx = new Transaction().add(
            SystemProgram.transfer({ fromPubkey, toPubkey, lamports })
          );
          tx.recentBlockhash = latestBlockhash.blockhash;
          tx.feePayer = fromPubkey;

          setNodeExecStatus(lightningNode.id, 'running');
          const signed = await provider.signTransaction(tx);
          const signature = await connection.sendRawTransaction(signed.serialize());
          await connection.confirmTransaction({
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          }, 'confirmed');

          toast({
            title: 'SOL Transfer Confirmed',
            description: `Sent ${amountSol} SOL to ${recipient.slice(0, 8)}... | Sig: ${signature.slice(0, 8)}...`,
          });
          setNodeExecStatus(lightningNode.id, 'success');

          executionActions.push({
            type: 'lightning',
            status: 'success',
            message: `Sent ${amountSol} SOL to ${recipient}`,
            signature,
            details: { recipient, amountSol, lamports },
          });
        } catch (err: any) {
          console.error('SOL transfer error:', err);
          toast({ title: 'SOL Transfer Failed', description: err.message || 'Unknown error', variant: 'destructive' });
          executionActions.push({ type: 'lightning', status: 'failed', message: err.message || 'Unknown error' });
          setNodeExecStatus(lightningNode.id, 'failed');
          return;
        }
      }

      // Find and execute ALL Claim Rewards nodes
      const claimNodes = nodes.filter(n => n.data?.type === 'claim');
      const claimNode = claimNodes[0] ?? null;

      const { handleClaimRewards } = await import('../lib/solana/claimRewards');

      for (const cNode of claimNodes) {
        const cfg = (cNode.data?.config || {}) as any;
        const poolAddress = cfg.poolAddress || undefined; // undefined = claim all pools

        try {
          toast({ title: 'Claiming Rewards...', description: poolAddress ? `From pool ${poolAddress.slice(0, 8)}…` : 'From all LP positions' });
          setNodeExecStatus(cNode.id, 'running');
          const summary = await handleClaimRewards({
            fromPubkey: new PublicKey(userPublicKey),
            poolAddress,
            autoReinvest: cfg.autoReinvest === true,
          });
          toast({ title: 'Rewards Claimed ✓', description: summary.message });
          setNodeExecStatus(cNode.id, 'success');
          executionActions.push({
            type: 'claim', status: 'success', message: summary.message,
            signature: summary.signature,
            details: { totalRewardUSD: summary.totalRewardUSD, pools: summary.results.length },
          });
        } catch (claimErr: any) {
          console.error('Claim rewards error:', claimErr);
          toast({ title: 'Claim Rewards Failed', description: claimErr.message || 'Unknown error', variant: 'destructive' });
          executionActions.push({ type: 'claim', status: 'failed', message: claimErr.message || 'Unknown error' });
          setNodeExecStatus(cNode.id, 'failed');
          return;
        }
      }

      // If no executable nodes found
      const hasExecutableNode = swapNode || liquidityNode || stakeNode || lightningNode || claimNode;
      if (!hasExecutableNode) {
        toast({ title: 'No Executable Actions', description: 'Add Swap, Liquidity, Stake, Claim Rewards, or Lightning modules to execute.', variant: 'destructive' });
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

      // Show time comparison panel
      setLastComparisonData({
        actions: executionActions.map((a) => ({ type: a.type, status: a.status })),
        totalDurationMs: executionDuration,
        workflowName: `Workflow (${nodes.length} nodes)`,
      });
      setShowTimeComparison(true);

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
    <>
      {lastComparisonData && (
        <TimeComparisonPanel
          open={showTimeComparison}
          onClose={() => setShowTimeComparison(false)}
          actions={lastComparisonData.actions}
          totalDurationMs={lastComparisonData.totalDurationMs}
          workflowName={lastComparisonData.workflowName}
        />
      )}

    <div className="flex-1 bg-dark-300 overflow-hidden flex flex-col h-[calc(100vh-64px)]">
      <div className="border-b border-dark-100 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-foreground">Canvas</h2>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="material-icons text-xs">info</span>
            <span>Drag modules from the library and connect them</span>
          </div>
          {wallet?.isConnected && (
            <>
              <div className="h-4 w-px bg-border" />
              <span className="text-xs px-2 py-0.5 bg-green-600/20 text-green-400 border border-green-600/30 rounded-full">
                {wallet.address.substring(0, 6)}…{wallet.address.slice(-4)}
              </span>
            </>
          )}
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
            <div className="pointer-events-auto max-w-lg w-full mx-6">
              <Card className="bg-dark-200/80 border border-dark-100 p-6 backdrop-blur-sm">
                <div className="text-center mb-5">
                  <span className="material-icons text-4xl text-gray-500 mb-2 block">drag_indicator</span>
                  <h3 className="text-lg font-medium">Empty Workflow</h3>
                  <p className="text-gray-400 text-sm mt-1">
                    Drag modules from the left panel, or load a preset below to get started
                  </p>
                </div>
                <PresetWorkflows />
              </Card>
            </div>
          </div>
        )}
      </div>
      
      <div className="border-t border-dark-100 px-4 py-3 flex items-center justify-between bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleNew} className="flex items-center gap-1.5 text-sm">
            <span className="material-icons text-sm">add</span>
            New
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear} className="flex items-center gap-1.5 text-sm text-destructive hover:text-destructive">
            <span className="material-icons text-sm">delete_outline</span>
            Clear
          </Button>
          {lastComparisonData && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTimeComparison(true)}
              className="flex items-center gap-1.5 text-sm text-blue-400 border-blue-400/30 hover:bg-blue-400/10"
            >
              <span className="material-icons text-sm">timer</span>
              Time Saved
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleValidate}
            className="flex items-center gap-1.5 text-sm bg-purple-600 text-white hover:bg-purple-700 border-purple-700"
          >
            <span className="material-icons text-sm">check_circle</span>
            Validate
          </Button>
          <Button
            size="sm"
            onClick={handleExecute}
            disabled={isExecuting}
            className="flex items-center gap-1.5 text-sm bg-green-600 text-white hover:bg-green-700 border-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-icons text-sm">rocket_launch</span>
            {isExecuting ? 'Executing…' : 'Execute'}
          </Button>
        </div>
      </div>

      {/* Execution History Panel */}
      <ExecutionHistory />
    </div>
    </>
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
