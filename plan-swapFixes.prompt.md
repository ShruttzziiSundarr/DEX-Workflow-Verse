## Plan: Fix Swap Token Mapping and On-Chain Routing

TL;DR: Correct swap input/output token selection by using custom mint addresses when provided, align execution with protocol/cluster choice, and keep Devnet/mock support while enabling Mainnet-Beta for real swaps. Use Jupiter as the fallback route for SushiSwap until direct Sushi integration is added.

**Steps**
1. Fix token mint mapping in `client/src/components/WorkflowCanvas.tsx`.
   - For generic swap, Orca swap, and Raydium swap branches, use `cfg.sourceMint` and `cfg.targetMint` when present.
   - Do not treat custom mint addresses as symbol strings; instead, use them directly as `inputMint`/`outputMint`.
   - Preserve display names separately from actual mint values so the node config can store custom addresses cleanly.
   - Make `cluster` dynamic rather than hardcoded to `devnet` when mainnet execution is requested.

2. Update `client/src/components/ConfigPanel.tsx`.
   - Ensure custom token address fields are saved into node config via `sourceMint`/`targetMint`.
   - Add validation and a clear UI label for custom Mint Address inputs.
   - Add or refine network/cluster selection so Mainnet-Beta can be chosen without breaking Devnet defaults.
   - Adjust the SushiSwap protocol option text to indicate it currently uses Jupiter aggregator fallback rather than direct Sushi execution.

3. Validate and improve `client/src/lib/solana/jupiterSwap.ts`.
   - Confirm the mainnet branch is used only for Mainnet-Beta.
   - Improve error messaging for devnet when Jupiter is requested without a custom pool.
   - Keep `outputDecimals` and `inputDecimals` logic consistent for custom mints.

4. Review routing behavior in `client/src/lib/solana/dexRouter.ts`.
   - If needed, centralize protocol routing so swap operations use the right on-chain path for `jupiter`, `raydium`, and `orca`.
   - Add a `sushiswap` fallback path that routes through Jupiter when direct SushiSwap is not implemented.

5. Optional cleanup and display fixes.
   - Update `client/src/components/action-templates.ts` if default swap node config needs to include the new custom-mint flow.
   - Consider updating `client/src/components/modules/WorkflowNode.tsx` to display custom mint addresses clearly.

**Verification**
1. Test Devnet generic swap (SOL -> USDC) and verify the UI updates and execution uses the right token mints.
2. Test custom token swap by selecting `CUSTOM` and entering a mint address, then confirm the execution uses that address, not SOL/USDC.
3. Test on-chain Mainnet-Beta Jupiter swap with a valid mainnet token pair.
4. Test Orca and Raydium swap flows on Devnet with real pool addresses or custom pools, and confirm fallback behavior is correct.
5. Check the SushiSwap protocol option behaves as Jupiter aggregator fallback and does not crash.

**Decisions**
- Keep Devnet/mock behavior as default, add Mainnet-Beta support for real swaps.
- Use Jupiter as the current fallback for SushiSwap instead of implementing direct Sushi support immediately.
- Fix token address mapping first, because it is the root cause of incorrect swap selection and pool lookup failures.

**Relevant files**
- `client/src/components/WorkflowCanvas.tsx`
- `client/src/components/ConfigPanel.tsx`
- `client/src/lib/solana/jupiterSwap.ts`
- `client/src/lib/solana/dexRouter.ts`
- `client/src/components/action-templates.ts`
- `client/src/components/modules/WorkflowNode.tsx`
