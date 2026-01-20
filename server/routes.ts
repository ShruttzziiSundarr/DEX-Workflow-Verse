import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWorkflowSchema, insertWorkflowActionSchema, insertWorkflowExecutionSchema, ExecutionStatusEnum } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

// Lightweight in-memory cache and rate limiting for wallet endpoints
const walletStatusCache = new Map<string, { data: { isValid: boolean; message: string }, timestamp: number }>();
const walletValidateCache = new Map<string, { data: { valid: boolean; message: string }, timestamp: number }>();
const CACHE_TTL_MS = 10000; // 10s cache TTL
const RATE_WINDOW_MS = 5000; // 5s rate window per address
const lastStatusHit = new Map<string, number>();
const lastValidateHit = new Map<string, number>();

export async function registerRoutes(app: Express): Promise<Server> {
  // === WORKFLOW ROUTES ===
  app.get("/api/workflows", async (req: Request, res: Response) => {
    try {
      const workflows = await storage.getWorkflows();
      res.json(workflows);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch workflows" });
    }
  });

  app.get("/api/workflows/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const workflow = await storage.getWorkflow(id);
      
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }
      
      res.json(workflow);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch workflow" });
    }
  });

  app.post("/api/workflows", async (req: Request, res: Response) => {
    try {
      // Add created and updated timestamps
      const workflowData = {
        ...req.body,
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };
      
      const parsedData = insertWorkflowSchema.parse(workflowData);
      const workflow = await storage.createWorkflow(parsedData);
      res.status(201).json(workflow);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Failed to create workflow" });
      }
    }
  });

  app.put("/api/workflows/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Update the 'updated' timestamp
      const workflowData = {
        ...req.body,
        updated: new Date().toISOString()
      };
      
      const parsedData = insertWorkflowSchema.parse(workflowData);
      const workflow = await storage.updateWorkflow(id, parsedData);
      
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }
      
      res.json(workflow);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Failed to update workflow" });
      }
    }
  });

  app.delete("/api/workflows/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteWorkflow(id);
      
      if (!success) {
        return res.status(404).json({ message: "Workflow not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete workflow" });
    }
  });

  // === WORKFLOW ACTIONS ROUTES ===
  
  // Get all actions for a workflow
  app.get("/api/workflows/:workflowId/actions", async (req: Request, res: Response) => {
    try {
      const workflowId = parseInt(req.params.workflowId);
      const actions = await storage.getWorkflowActions(workflowId);
      res.json(actions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch workflow actions" });
    }
  });
  
  // Create a new action for a workflow
  app.post("/api/workflows/:workflowId/actions", async (req: Request, res: Response) => {
    try {
      const workflowId = parseInt(req.params.workflowId);
      
      // Make sure the workflow exists
      const workflow = await storage.getWorkflow(workflowId);
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }
      
      // Add the workflowId to the action data
      const actionData = {
        ...req.body,
        workflowId
      };
      
      const parsedAction = insertWorkflowActionSchema.parse(actionData);
      const action = await storage.createWorkflowAction(parsedAction);
      res.status(201).json(action);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Failed to create workflow action" });
      }
    }
  });
  
  // Update a workflow action
  app.put("/api/workflows/actions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const actionData = insertWorkflowActionSchema.partial().parse(req.body);
      const updatedAction = await storage.updateWorkflowAction(id, actionData);
      
      if (!updatedAction) {
        return res.status(404).json({ message: "Workflow action not found" });
      }
      
      res.json(updatedAction);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Failed to update workflow action" });
      }
    }
  });
  
  // Delete a workflow action
  app.delete("/api/workflows/actions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteWorkflowAction(id);
      
      if (!success) {
        return res.status(404).json({ message: "Workflow action not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete workflow action" });
    }
  });
  
  // === WORKFLOW EXECUTION ROUTES ===
  
  // Get all executions for a workflow
  app.get("/api/workflows/:workflowId/executions", async (req: Request, res: Response) => {
    try {
      const workflowId = parseInt(req.params.workflowId);
      const executions = await storage.getWorkflowExecutions(workflowId);
      res.json(executions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch workflow executions" });
    }
  });
  
  // Get a specific execution
  app.get("/api/workflows/executions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const execution = await storage.getWorkflowExecution(id);
      
      if (!execution) {
        return res.status(404).json({ message: "Workflow execution not found" });
      }
      
      res.json(execution);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch workflow execution" });
    }
  });
  
  // Execute a workflow
  app.post("/api/workflows/:workflowId/execute", async (req: Request, res: Response) => {
    try {
      const workflowId = parseInt(req.params.workflowId);
      
      // Make sure the workflow exists
      const workflow = await storage.getWorkflow(workflowId);
      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }
      
      // Create a new execution record with "pending" status
      const executionData = {
        workflowId,
        status: 'pending'
      };
      
      const parsedData = insertWorkflowExecutionSchema.parse(executionData);
      const execution = await storage.createWorkflowExecution(parsedData);
      
      // Return the execution ID immediately so the client can poll for updates
      res.status(202).json(execution);
      
      // Process the workflow in the background
      setTimeout(() => {
        processWorkflow(workflowId, execution.id);
      }, 0);
      
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Failed to execute workflow" });
      }
    }
  });

  // Wallet validation endpoint with lightweight cache and per-address rate limit
  app.post("/api/wallet/validate", async (req: Request, res: Response) => {
    try {
      const { address } = req.body;
      if (!address || typeof address !== 'string') {
        return res.status(400).json({ valid: false, message: "Invalid wallet address format" });
      }

      const now = Date.now();
      const cached = walletValidateCache.get(address);
      const last = lastValidateHit.get(address) || 0;

      // Serve cached result if fresh
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        lastValidateHit.set(address, now);
        return res.json(cached.data);
      }
      // Within rate window, reuse last cached result if present
      if (now - last < RATE_WINDOW_MS && cached) {
        lastValidateHit.set(address, now);
        return res.json(cached.data);
      }

      try {
        // Basic Solana address validation (base58 check, length check)
        const isBase58 = /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
        const isValidLength = address.length >= 32 && address.length <= 44;
        const responseData = isBase58 && isValidLength
          ? { valid: true, message: "Wallet address is valid" }
          : { valid: false, message: "Invalid Solana wallet address format" };

        walletValidateCache.set(address, { data: responseData, timestamp: now });
        lastValidateHit.set(address, now);
        return res.json(responseData);
      } catch (_err) {
        const responseData = { valid: false, message: "Invalid Solana wallet address format" };
        walletValidateCache.set(address, { data: responseData, timestamp: now });
        lastValidateHit.set(address, now);
        return res.json(responseData);
      }
    } catch (error) {
      console.error('Wallet validation error:', error);
      return res.status(500).json({ valid: false, message: 'Error validating wallet address' });
    }
  });

  // Wallet status endpoint with cache and per-address rate limit
  app.get("/api/wallet/status/:address", async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      if (!address) {
        return res.status(400).setHeader('Content-Type', 'application/json').json({ isValid: false, message: "Address is required" });
      }

      // Force the response to be JSON and disable caching to avoid 304
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const now = Date.now();
      const cached = walletStatusCache.get(address);
      const last = lastStatusHit.get(address) || 0;

      // Serve cached result if fresh
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        lastStatusHit.set(address, now);
        return res.status(200).json(cached.data);
      }
      // Within rate window, reuse last cached result if present
      if (now - last < RATE_WINDOW_MS && cached) {
        lastStatusHit.set(address, now);
        return res.status(200).json(cached.data);
      }

      // Check address format (Ethereum or Solana)
      const isEthereumAddress = address.startsWith("0x") && address.length === 42;
      const isSolanaAddress = address.length >= 32 && address.length <= 44 && !address.startsWith("0x");
      const isValidAddress = isEthereumAddress || isSolanaAddress;

      const data = { isValid: isValidAddress, message: isValidAddress ? "Wallet is connected" : "Wallet is disconnected" };
      walletStatusCache.set(address, { data, timestamp: now });
      lastStatusHit.set(address, now);

      return res.status(200).json(data);
    } catch (error) {
      console.error('Wallet status check error:', error);
      return res.status(500).setHeader('Content-Type', 'application/json').json({ isValid: false, message: "Error checking wallet status" });
    }
  });

  // === DEFI ACTIONS (SIMULATION, REALISTIC) ===
  // === SOLANA SWAP ENDPOINT (Mock for Devnet) ===
  /**
   * POST /api/swap
   * Request: { inputMint, outputMint, amount, slippage, fromPubkey, inputSymbol, outputSymbol }
   * Response: { success, simulated, signature, inputAmount, outputAmount, mode, message }
   */
  app.post("/api/swap", async (req: Request, res: Response) => {
    const {
      inputMint,
      outputMint,
      amount,
      slippage,
      fromPubkey,
      inputSymbol,
      outputSymbol,
      // Legacy params for backwards compatibility
      from,
      to
    } = req.body;

    try {
      // Mock token data for devnet
      const MOCK_TOKENS: Record<string, { decimals: number; priceUsd: number }> = {
        'SOL': { decimals: 9, priceUsd: 150.0 },
        'So11111111111111111111111111111111111111112': { decimals: 9, priceUsd: 150.0 },
        'USDC': { decimals: 6, priceUsd: 1.0 },
        '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': { decimals: 6, priceUsd: 1.0 },
        'USDT': { decimals: 6, priceUsd: 1.0 },
        'EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS': { decimals: 6, priceUsd: 1.0 },
        'BONK': { decimals: 5, priceUsd: 0.00001 },
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { decimals: 5, priceUsd: 0.00001 },
      };

      // Normalize input/output
      const inSymbol = inputSymbol || from || 'SOL';
      const outSymbol = outputSymbol || to || 'USDC';
      const inToken = MOCK_TOKENS[inputMint] || MOCK_TOKENS[inSymbol] || MOCK_TOKENS['SOL'];
      const outToken = MOCK_TOKENS[outputMint] || MOCK_TOKENS[outSymbol] || MOCK_TOKENS['USDC'];

      const amountIn = parseFloat(amount || '1');
      const slippagePct = parseFloat(slippage || '1');

      // Calculate exchange rate using mock prices
      const exchangeRate = inToken.priceUsd / outToken.priceUsd;
      const rawOutputAmount = amountIn * exchangeRate;

      // Apply 0.3% swap fee
      const feePercent = 0.003;
      const outputAmountAfterFee = rawOutputAmount * (1 - feePercent);

      // Apply slippage
      const minAmountOut = outputAmountAfterFee * (1 - slippagePct / 100);

      // Generate mock signature
      const mockSignature = 'mock_swap_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      res.json({
        success: true,
        simulated: true,
        signature: mockSignature,
        inputMint: inputMint || inSymbol,
        outputMint: outputMint || outSymbol,
        inputSymbol: inSymbol,
        outputSymbol: outSymbol,
        inputAmount: amountIn,
        outputAmount: minAmountOut,
        exchangeRate,
        fee: feePercent * 100,
        slippage: slippagePct,
        mode: 'mock',
        message: `Successfully swapped ${amountIn} ${inSymbol} for ~${minAmountOut.toFixed(4)} ${outSymbol} (Mock)`
      });
    } catch (error) {
      console.error('Swap error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Solana Staking endpoint
  /**
   * POST /api/stake
   * Request: { action, amount, validatorPubkey, stakeAccountPubkey, fromPubkey }
   * Response: { success, signature, message }
   */
  app.post("/api/stake", async (req: Request, res: Response) => {
    const { action, amount, validatorPubkey, stakeAccountPubkey, fromPubkey } = req.body;
    try {
      const { handleSolanaStake } = await import('../client/src/lib/solana/solanaStaking');
      const { PublicKey } = await import('@solana/web3.js');

      if (!fromPubkey) {
        return res.status(400).json({ success: false, error: 'Wallet public key is required' });
      }

      const validActions = ['delegate', 'deactivate', 'withdraw'];
      if (!validActions.includes(action)) {
        return res.status(400).json({ success: false, error: 'Invalid action' });
      }

      if (action === 'delegate') {
        if (!amount || !validatorPubkey) {
          return res.status(400).json({ success: false, error: 'Amount and validatorPubkey are required for delegate' });
        }
      } else if (action === 'deactivate' || action === 'withdraw') {
        if (!stakeAccountPubkey) {
          return res.status(400).json({ success: false, error: 'stakeAccountPubkey is required for this action' });
        }
      }

      const signature = await handleSolanaStake({
        action,
        amount: action === 'delegate' ? parseFloat(amount) : undefined,
        validatorPubkey,
        stakeAccountPubkey,
        fromPubkey: new PublicKey(fromPubkey),
      });

      res.json({
        success: true,
        signature,
        message: 'Transaction confirmed',
        action,
        amount: action === 'delegate' ? amount : undefined,
        validatorPubkey: action === 'delegate' ? validatorPubkey : undefined,
        stakeAccountPubkey: action !== 'delegate' ? stakeAccountPubkey : undefined,
      });
    } catch (error) {
      console.error('Solana stake transaction error:', error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
  // Marinade Staking Endpoints
  app.post("/api/marinade/stake", async (req: Request, res: Response) => {
    const { action, amount, stakeAccountPubkey, fromPubkey } = req.body;
    try {
      const { handleMarinadeStake } = await import('../client/src/lib/solana/marinadeStaking');
      const { PublicKey } = await import('@solana/web3.js');
      
      if (!fromPubkey) {
        return res.status(400).json({ 
          success: false, 
          error: 'Wallet public key is required' 
        });
      }

      // Validate required parameters
      if (action === 'stake' && !amount) {
        return res.status(400).json({ 
          success: false, 
          error: 'Amount is required for staking' 
        });
      }

      if (action === 'unstake' && !stakeAccountPubkey) {
        return res.status(400).json({ 
          success: false, 
          error: 'Stake account is required for unstaking' 
        });
      }

      // Prepare the staking transaction
      const result = await handleMarinadeStake({
        action,
        amount: action === 'stake' ? parseFloat(amount) : undefined,
        stakeAccountPubkey,
        fromPubkey: new PublicKey(fromPubkey),
      });

      res.json({
        success: true,
        transaction: result.transaction,
        message: result.message,
        action,
        amount: action === 'stake' ? amount : undefined,
        stakeAccountPubkey: action === 'unstake' ? stakeAccountPubkey : undefined,
      });
    } catch (error) {
      console.error('Marinade stake transaction error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Get Marinade stake accounts for a wallet
  app.get("/api/marinade/accounts/:walletAddress", async (req: Request, res: Response) => {
    try {
      const { getMarinadeStakeAccounts } = await import('../client/src/lib/solana/marinadeStaking');
      const { PublicKey } = await import('@solana/web3.js');
      
      const walletAddress = req.params.walletAddress;
      if (!walletAddress) {
        return res.status(400).json({ 
          success: false, 
          error: 'Wallet address is required' 
        });
      }

      const stakeAccounts = await getMarinadeStakeAccounts(new PublicKey(walletAddress));
      
      res.json({
        success: true,
        ...stakeAccounts
      });
    } catch (error) {
      console.error('Error fetching Marinade stake accounts:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // === LIQUIDITY POOL ENDPOINTS ===

  /**
   * POST /api/liquidity
   * Add or remove liquidity from a pool (simulated for server-side)
   * Request: { action, tokenA, tokenB, amountA, amountB, lpTokenAmount, slippage, fromPubkey }
   * Response: { success, signature, lpTokensReceived, tokenAReceived, tokenBReceived, message }
   * Note: Real transactions should be executed client-side with wallet signing
   */
  app.post("/api/liquidity", async (req: Request, res: Response) => {
    const { action, tokenA, tokenB, amountA, amountB, lpTokenAmount, slippage, fromPubkey } = req.body;
    try {
      if (!fromPubkey) {
        return res.status(400).json({ success: false, error: 'Wallet public key is required' });
      }

      const validActions = ['addLiquidity', 'removeLiquidity'];
      if (!validActions.includes(action)) {
        return res.status(400).json({ success: false, error: 'Invalid action. Must be addLiquidity or removeLiquidity' });
      }

      if (!tokenA || !tokenB) {
        return res.status(400).json({ success: false, error: 'Token pair is required' });
      }

      if (action === 'addLiquidity' && (!amountA || !amountB)) {
        return res.status(400).json({ success: false, error: 'Both token amounts are required for adding liquidity' });
      }

      if (action === 'removeLiquidity' && !lpTokenAmount) {
        return res.status(400).json({ success: false, error: 'LP token amount is required for removing liquidity' });
      }

      // Server-side simulation (mock mode for devnet)
      // Real transactions should happen client-side with wallet
      const mockSignature = 'mock_lp_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
      const slippageNum = parseFloat(slippage || '1');

      // Mock pool data
      const mockPools: Record<string, { reserveA: number; reserveB: number; lpSupply: number }> = {
        'SOL/USDC': { reserveA: 10000, reserveB: 1500000, lpSupply: 100000 },
        'SOL/USDT': { reserveA: 5000, reserveB: 750000, lpSupply: 50000 },
        'RAY/SOL': { reserveA: 100000, reserveB: 2000, lpSupply: 25000 },
      };

      const poolKey = `${tokenA}/${tokenB}`;
      const reversePoolKey = `${tokenB}/${tokenA}`;
      const pool = mockPools[poolKey] || mockPools[reversePoolKey];

      if (!pool) {
        return res.status(400).json({
          success: false,
          error: `Pool ${poolKey} not found. Available pools: ${Object.keys(mockPools).join(', ')}`
        });
      }

      if (action === 'addLiquidity') {
        const amtA = parseFloat(amountA);
        const amtB = parseFloat(amountB);
        const currentK = Math.sqrt(pool.reserveA * pool.reserveB);
        const addedK = Math.sqrt(amtA * amtB);
        const lpTokensReceived = (addedK / currentK) * pool.lpSupply * (1 - slippageNum / 100);

        res.json({
          success: true,
          simulated: true,
          signature: mockSignature,
          lpTokensReceived,
          poolAddress: `MockPool_${tokenA}_${tokenB}`,
          mode: 'mock',
          message: `Successfully added ${amtA} ${tokenA} + ${amtB} ${tokenB} to pool. Received ${lpTokensReceived.toFixed(4)} LP tokens.`,
          action,
          tokenA,
          tokenB,
        });
      } else {
        const lpAmt = parseFloat(lpTokenAmount);
        const sharePercent = lpAmt / pool.lpSupply;
        const tokenAReceived = pool.reserveA * sharePercent * (1 - slippageNum / 100);
        const tokenBReceived = pool.reserveB * sharePercent * (1 - slippageNum / 100);

        res.json({
          success: true,
          simulated: true,
          signature: mockSignature,
          tokenAReceived,
          tokenBReceived,
          poolAddress: `MockPool_${tokenA}_${tokenB}`,
          mode: 'mock',
          message: `Successfully removed ${lpAmt} LP tokens. Received ${tokenAReceived.toFixed(4)} ${tokenA} + ${tokenBReceived.toFixed(4)} ${tokenB}.`,
          action,
          tokenA,
          tokenB,
        });
      }
    } catch (error) {
      console.error('Liquidity pool operation error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Mock pool data for server-side endpoints
  const MOCK_LP_POOLS: Record<string, {
    poolAddress: string;
    tokenA: string;
    tokenB: string;
    reserveA: number;
    reserveB: number;
    lpSupply: number;
    apr: number;
    fee: number;
  }> = {
    'SOL/USDC': {
      poolAddress: 'MockPool11111111111111111111111111111111111',
      tokenA: 'SOL',
      tokenB: 'USDC',
      reserveA: 10000,
      reserveB: 1500000,
      lpSupply: 100000,
      apr: 24.5,
      fee: 0.25,
    },
    'SOL/USDT': {
      poolAddress: 'MockPool22222222222222222222222222222222222',
      tokenA: 'SOL',
      tokenB: 'USDT',
      reserveA: 5000,
      reserveB: 750000,
      lpSupply: 50000,
      apr: 18.2,
      fee: 0.25,
    },
    'RAY/SOL': {
      poolAddress: 'MockPool33333333333333333333333333333333333',
      tokenA: 'RAY',
      tokenB: 'SOL',
      reserveA: 100000,
      reserveB: 2000,
      lpSupply: 25000,
      apr: 32.1,
      fee: 0.25,
    },
  };

  /**
   * GET /api/liquidity/pool/:tokenA/:tokenB
   * Get pool information for a token pair
   */
  app.get("/api/liquidity/pool/:tokenA/:tokenB", async (req: Request, res: Response) => {
    try {
      const { tokenA, tokenB } = req.params;

      if (!tokenA || !tokenB) {
        return res.status(400).json({ success: false, error: 'Token pair is required' });
      }

      const poolKey = `${tokenA}/${tokenB}`;
      const reversePoolKey = `${tokenB}/${tokenA}`;
      const pool = MOCK_LP_POOLS[poolKey] || MOCK_LP_POOLS[reversePoolKey];

      if (!pool) {
        return res.status(404).json({
          success: false,
          error: `Pool ${poolKey} not found. Available pools: ${Object.keys(MOCK_LP_POOLS).join(', ')}`
        });
      }

      res.json({
        success: true,
        ...pool,
        mode: 'mock',
      });
    } catch (error) {
      console.error('Error fetching pool info:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /api/liquidity/positions/:walletAddress
   * Get user's LP positions (mock data for devnet)
   */
  app.get("/api/liquidity/positions/:walletAddress", async (req: Request, res: Response) => {
    try {
      const walletAddress = req.params.walletAddress;
      if (!walletAddress) {
        return res.status(400).json({ success: false, error: 'Wallet address is required' });
      }

      // Return empty positions for mock (positions are tracked client-side in memory)
      res.json({
        success: true,
        positions: [],
        mode: 'mock',
        message: 'LP positions are tracked client-side for devnet mock mode',
      });
    } catch (error) {
      console.error('Error fetching LP positions:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /api/liquidity/pools
   * Get available liquidity pools
   */
  app.get("/api/liquidity/pools", async (req: Request, res: Response) => {
    try {
      const pools = Object.values(MOCK_LP_POOLS).map(pool => ({
        tokenA: pool.tokenA,
        tokenB: pool.tokenB,
        apr: pool.apr,
        poolAddress: pool.poolAddress,
      }));

      res.json({
        success: true,
        pools,
        mode: 'mock',
      });
    } catch (error) {
      console.error('Error fetching available pools:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Simulated Claim Rewards endpoint
  /**
   * POST /api/claim-rewards
   * Request: { from, token, action ("claim-rewards"), [privateKey] }
   * Response: { success, simulated, tx: { hash, from, to, value, status, action, timestamp }, message }
   */
  app.post("/api/claim-rewards", async (req: Request, res: Response) => {
    const { from, token, action = "claim-rewards", privateKey } = req.body;
    try {
      const reward = (Math.random() * 10).toFixed(4);
      const txHash = "0x" + Math.random().toString(16).slice(2, 18).padEnd(64, "0");
      const now = new Date();
      setTimeout(() => {
        res.json({
          success: true,
          simulated: true,
          tx: {
            hash: txHash,
            from,
            to: token + "_staking_contract",
            value: parseFloat(reward),
            status: "confirmed",
            action,
            timestamp: now.toISOString(),
            privateKey,
          },
          message: `Transaction confirmed! Claimed ${reward} ${token}`
        });
      }, 2500);
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

// Mock token prices for workflow execution
const WORKFLOW_MOCK_PRICES: Record<string, number> = {
  'SOL': 150.00,
  'USDC': 1.00,
  'USDT': 1.00,
  'BONK': 0.00001,
  'RAY': 0.50,
};

// Helper function to execute a single workflow node based on its type
async function executeNode(node: any, walletAddress?: string, previousResults?: Map<string, any>): Promise<{ success: boolean; result: any; message: string }> {
  const nodeType = node.data?.type;
  const config = node.data?.config || {};

  console.log(`[Workflow] Executing node: ${node.id} (type: ${nodeType})`);
  console.log(`[Workflow] Node config:`, config);

  switch (nodeType) {
    case 'swap': {
      // Execute swap with proper mock calculation
      const { sourceToken, targetToken, amount, slippage, inputMint, outputMint } = config;

      // Get token symbols
      const inSymbol = sourceToken || 'SOL';
      const outSymbol = targetToken || 'USDC';

      // Get prices
      const inPrice = WORKFLOW_MOCK_PRICES[inSymbol] || 1;
      const outPrice = WORKFLOW_MOCK_PRICES[outSymbol] || 1;
      const exchangeRate = inPrice / outPrice;

      const amountIn = parseFloat(amount || '1');
      const slippageNum = parseFloat(slippage || '1');

      // Calculate output with fee and slippage
      const rawOutput = amountIn * exchangeRate;
      const outputAfterFee = rawOutput * 0.997; // 0.3% fee
      const outputAfterSlippage = outputAfterFee * (1 - slippageNum / 100);

      // Generate mock signature
      const mockSignature = 'mock_swap_' + Math.random().toString(36).substr(2, 16);

      await new Promise(resolve => setTimeout(resolve, 1500));

      const result = {
        inputToken: inSymbol,
        outputToken: outSymbol,
        inputAmount: amountIn,
        outputAmount: outputAfterSlippage,
        exchangeRate,
        slippage: slippageNum,
        fee: 0.3,
        signature: mockSignature,
        mode: 'mock',
      };

      return {
        success: true,
        result,
        message: `Swapped ${amountIn} ${inSymbol} for ~${outputAfterSlippage.toFixed(4)} ${outSymbol}`
      };
    }

    case 'liquidityPool':
    case 'addLiquidity':
    case 'removeLiquidity': {
      const { action, tokenA, tokenB, amountA, amountB, lpTokenAmount, slippage } = config;
      const lpAction = action || (nodeType === 'removeLiquidity' ? 'removeLiquidity' : 'addLiquidity');

      // Mock pool data
      const mockPools: Record<string, { reserveA: number; reserveB: number; lpSupply: number }> = {
        'SOL/USDC': { reserveA: 10000, reserveB: 1500000, lpSupply: 100000 },
        'SOL/USDT': { reserveA: 5000, reserveB: 750000, lpSupply: 50000 },
        'RAY/SOL': { reserveA: 100000, reserveB: 2000, lpSupply: 25000 },
      };

      const poolKey = `${tokenA || 'SOL'}/${tokenB || 'USDC'}`;
      const reversePoolKey = `${tokenB || 'USDC'}/${tokenA || 'SOL'}`;
      const pool = mockPools[poolKey] || mockPools[reversePoolKey] || mockPools['SOL/USDC'];

      await new Promise(resolve => setTimeout(resolve, 2000));
      const slippageNum = parseFloat(slippage || '1');

      if (lpAction === 'addLiquidity') {
        const amtA = parseFloat(amountA || '1');
        const amtB = parseFloat(amountB || '150');
        const currentK = Math.sqrt(pool.reserveA * pool.reserveB);
        const addedK = Math.sqrt(amtA * amtB);
        const lpTokensReceived = (addedK / currentK) * pool.lpSupply * (1 - slippageNum / 100);

        return {
          success: true,
          result: {
            action: 'addLiquidity',
            tokenA: tokenA || 'SOL',
            tokenB: tokenB || 'USDC',
            amountA: amtA,
            amountB: amtB,
            lpTokensReceived: lpTokensReceived.toFixed(4),
            poolAddress: `MockPool_${tokenA || 'SOL'}_${tokenB || 'USDC'}`,
          },
          message: `Added ${amtA} ${tokenA || 'SOL'} + ${amtB} ${tokenB || 'USDC'} to pool. Received ${lpTokensReceived.toFixed(4)} LP tokens.`
        };
      } else {
        const lpAmt = parseFloat(lpTokenAmount || '10');
        const sharePercent = lpAmt / pool.lpSupply;
        const tokenAReceived = pool.reserveA * sharePercent * (1 - slippageNum / 100);
        const tokenBReceived = pool.reserveB * sharePercent * (1 - slippageNum / 100);

        return {
          success: true,
          result: {
            action: 'removeLiquidity',
            tokenA: tokenA || 'SOL',
            tokenB: tokenB || 'USDC',
            lpTokenAmount: lpAmt,
            tokenAReceived: tokenAReceived.toFixed(4),
            tokenBReceived: tokenBReceived.toFixed(4),
          },
          message: `Removed ${lpAmt} LP tokens. Received ${tokenAReceived.toFixed(4)} ${tokenA || 'SOL'} + ${tokenBReceived.toFixed(4)} ${tokenB || 'USDC'}.`
        };
      }
    }

    case 'stake': {
      const { action: stakeAction, amount, validatorPubkey, stakeAccountPubkey, stakingType } = config;

      // Determine staking type (native Solana or Marinade)
      const useMarinadeStaking = stakingType === 'marinade';

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate mock signature
      const mockSignature = 'mock_stake_' + Math.random().toString(36).substr(2, 16);

      // Handle different staking actions
      const action = stakeAction || 'delegate';
      const stakeAmount = parseFloat(amount || '1');

      if (action === 'delegate' || action === 'stake') {
        // Staking operation
        return {
          success: true,
          result: {
            action,
            amount: stakeAmount,
            validator: validatorPubkey || 'Auto-selected',
            stakingType: useMarinadeStaking ? 'marinade' : 'native',
            signature: mockSignature,
            mode: 'mock',
            estimatedRewards: {
              apy: useMarinadeStaking ? 7.5 : 6.8, // Mock APY
              dailyReward: (stakeAmount * (useMarinadeStaking ? 0.075 : 0.068)) / 365,
            },
          },
          message: `Staked ${stakeAmount} SOL via ${useMarinadeStaking ? 'Marinade' : 'native staking'}`
        };
      } else if (action === 'deactivate') {
        // Deactivation operation
        return {
          success: true,
          result: {
            action,
            stakeAccountPubkey: stakeAccountPubkey || 'mock_stake_account',
            signature: mockSignature,
            mode: 'mock',
            cooldownEpochs: 2, // Approximate epochs until withdrawal
          },
          message: `Deactivated stake account. Funds will be available after cooldown period.`
        };
      } else if (action === 'withdraw') {
        // Withdrawal operation
        return {
          success: true,
          result: {
            action,
            stakeAccountPubkey: stakeAccountPubkey || 'mock_stake_account',
            withdrawnAmount: stakeAmount,
            signature: mockSignature,
            mode: 'mock',
          },
          message: `Withdrew ${stakeAmount} SOL from stake account`
        };
      } else if (action === 'unstake' || action === 'liquidUnstake') {
        // Marinade unstake
        return {
          success: true,
          result: {
            action,
            amount: stakeAmount,
            signature: mockSignature,
            mode: 'mock',
            instant: action === 'liquidUnstake',
          },
          message: action === 'liquidUnstake'
            ? `Instant unstaked ${stakeAmount} mSOL for SOL`
            : `Requested unstake of ${stakeAmount} mSOL (delayed)`
        };
      }

      return {
        success: true,
        result: { action, amount: stakeAmount, signature: mockSignature, mode: 'mock' },
        message: `${action} ${stakeAmount} SOL`
      };
    }

    case 'claim': {
      const { fromPool, token, autoReinvest } = config;
      await new Promise(resolve => setTimeout(resolve, 1000));
      const claimedAmount = (Math.random() * 100).toFixed(2);
      return {
        success: true,
        result: {
          pool: fromPool || 'Yield Farm',
          token: token || 'YIELD',
          amount: claimedAmount,
          autoReinvest: autoReinvest || false,
        },
        message: `Claimed ${claimedAmount} ${token || 'YIELD'} from ${fromPool || 'Yield Farm'}`
      };
    }

    case 'bridge': {
      const { sourceChain, targetChain, amount } = config;
      await new Promise(resolve => setTimeout(resolve, 3000));
      return {
        success: true,
        result: {
          sourceChain: sourceChain || 'Bitcoin',
          targetChain: targetChain || 'sBTC Network',
          amount: amount || '0.1',
        },
        message: `Bridged ${amount || '0.1'} BTC from ${sourceChain || 'Bitcoin'} to ${targetChain || 'sBTC Network'}`
      };
    }

    case 'lightning': {
      const { recipient, amount, memo } = config;
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        success: true,
        result: {
          recipient: recipient || 'lightning@example.com',
          amount: amount || '0.01',
          memo: memo || '',
        },
        message: `Sent ${amount || '0.01'} BTC via Lightning to ${recipient || 'lightning@example.com'}`
      };
    }

    default:
      return {
        success: true,
        result: { type: nodeType },
        message: `Executed ${nodeType || 'unknown'} node`
      };
  }
}

// Function to process workflow execution in the background
async function processWorkflow(workflowId: number, executionId: number) {
  try {
    // Update status to running
    await storage.updateWorkflowExecutionStatus(executionId, 'running');

    // Get the workflow
    const workflow = await storage.getWorkflow(workflowId);
    if (!workflow) {
      await storage.updateWorkflowExecutionStatus(
        executionId,
        'failed',
        {},
        'Workflow not found'
      );
      return;
    }

    // Get workflow nodes and edges
    const nodes = workflow.nodes || [];
    const edges = workflow.edges || [];

    // Build execution order (topological sort based on edges)
    const nodeMap = new Map(nodes.map((n: any) => [n.id, n]));
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    nodes.forEach((n: any) => {
      inDegree.set(n.id, 0);
      adjacency.set(n.id, []);
    });

    edges.forEach((e: any) => {
      adjacency.get(e.source)?.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    });

    // Find starting nodes (no incoming edges)
    const queue: string[] = [];
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) queue.push(nodeId);
    });

    const executionOrder: string[] = [];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      executionOrder.push(nodeId);
      adjacency.get(nodeId)?.forEach(targetId => {
        const newDegree = (inDegree.get(targetId) || 1) - 1;
        inDegree.set(targetId, newDegree);
        if (newDegree === 0) queue.push(targetId);
      });
    }

    // Execute nodes in order, passing results between connected nodes
    const nodeResults: any[] = [];
    const nodeOutputs = new Map<string, any>(); // Store outputs for passing to downstream nodes

    for (const nodeId of executionOrder) {
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      try {
        // Find incoming edges to get previous node outputs
        const incomingEdges = edges.filter((e: any) => e.target === nodeId);
        const previousOutputs: any[] = [];

        for (const edge of incomingEdges) {
          const sourceOutput = nodeOutputs.get(edge.source);
          if (sourceOutput) {
            previousOutputs.push({
              sourceNodeId: edge.source,
              output: sourceOutput
            });
          }
        }

        // If this node follows a swap and is a stake, use the swap output
        if (node.data?.type === 'stake' && previousOutputs.length > 0) {
          const swapOutput = previousOutputs.find(p => p.output?.outputToken || p.output?.outputAmount);
          if (swapOutput?.output) {
            // Use the output of the swap as the stake amount (if output is SOL)
            const prevResult = swapOutput.output;
            if (prevResult.outputToken === 'SOL' || prevResult.outputMint?.includes('So11111')) {
              console.log(`[Workflow] Chaining swap output to stake: ${prevResult.outputAmount} SOL`);
              // Update node config with the output amount from swap
              if (node.data.config) {
                node.data.config.amount = String(prevResult.outputAmount);
              }
            }
          }
        }

        const result = await executeNode(node, undefined, nodeOutputs);

        // Store the output for downstream nodes
        nodeOutputs.set(nodeId, result.result);

        nodeResults.push({
          nodeId,
          label: node.data?.label || nodeId,
          type: node.data?.type,
          ...result,
          chainedFrom: previousOutputs.length > 0 ? previousOutputs.map(p => p.sourceNodeId) : undefined,
        });
        console.log(`[Workflow] Node ${nodeId} completed: ${result.message}`);
      } catch (nodeError) {
        nodeResults.push({
          nodeId,
          label: node.data?.label || nodeId,
          type: node.data?.type,
          success: false,
          result: null,
          message: nodeError instanceof Error ? nodeError.message : 'Node execution failed'
        });
        console.error(`[Workflow] Node ${nodeId} failed:`, nodeError);
        // Optionally: break on failure or continue with remaining nodes
      }
    }

    // Compile final result
    const result = {
      completedNodes: nodeResults.filter(r => r.success).length,
      totalNodes: nodes.length,
      nodeResults,
      executionOrder,
    };

    // Update status to completed
    await storage.updateWorkflowExecutionStatus(executionId, 'completed', result);
    console.log(`[Workflow] Execution ${executionId} completed successfully`);

  } catch (error) {
    console.error("Error processing workflow:", error);

    // Update status to failed
    await storage.updateWorkflowExecutionStatus(
      executionId,
      'failed',
      {},
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}
