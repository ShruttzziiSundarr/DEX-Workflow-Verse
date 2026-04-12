import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Traditional (manual) time estimates in seconds per operation type
const TRADITIONAL_TIMES: Record<string, { seconds: number; label: string; description: string }> = {
  swap: {
    seconds: 180,
    label: "3 min",
    description: "Navigate to DEX, connect wallet, find token pair, configure slippage, approve & confirm",
  },
  jupiterSwap: {
    seconds: 180,
    label: "3 min",
    description: "Navigate to Jupiter, connect wallet, find token pair, approve & confirm",
  },
  addLiquidity: {
    seconds: 600,
    label: "10 min",
    description: "Find pool, approve both tokens, input amounts, add liquidity, wait for confirmation",
  },
  removeLiquidity: {
    seconds: 480,
    label: "8 min",
    description: "Locate LP position, approve LP tokens, remove liquidity, wait for confirmation",
  },
  liquidityPool: {
    seconds: 540,
    label: "9 min",
    description: "Find pool, configure amounts, approve tokens, execute pool operation",
  },
  stake: {
    seconds: 900,
    label: "15 min",
    description: "Research validators, create stake account, delegate SOL, wait for epoch activation",
  },
  claim: {
    seconds: 300,
    label: "5 min",
    description: "Check accumulated rewards, navigate to claim page, approve & harvest",
  },
  bridge: {
    seconds: 2700,
    label: "45 min",
    description: "Use bridge UI, lock assets, wait for cross-chain confirmations on both networks",
  },
  lightning: {
    seconds: 420,
    label: "7 min",
    description: "Set up payment channel, configure recipient, sign & broadcast payment",
  },
};

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface ComparisonAction {
  type: string;
  status: "success" | "failed" | "pending";
  durationMs?: number;
}

interface TimeComparisonPanelProps {
  open: boolean;
  onClose: () => void;
  actions: ComparisonAction[];
  totalDurationMs: number;
  workflowName: string;
}

export function TimeComparisonPanel({
  open,
  onClose,
  actions,
  totalDurationMs,
  workflowName,
}: TimeComparisonPanelProps) {
  const successfulActions = actions.filter((a) => a.status === "success");

  const rows = successfulActions.map((action) => {
    const traditional = TRADITIONAL_TIMES[action.type] || {
      seconds: 120,
      label: "2 min",
      description: "Manual steps required",
    };
    return {
      type: action.type,
      traditionalSeconds: traditional.seconds,
      traditionalLabel: traditional.label,
      description: traditional.description,
    };
  });

  const totalTraditionalSeconds = rows.reduce((sum, r) => sum + r.traditionalSeconds, 0);
  const totalDexSeconds = totalDurationMs / 1000;
  const savedSeconds = totalTraditionalSeconds - totalDexSeconds;
  const savedPercent =
    totalTraditionalSeconds > 0
      ? Math.round((savedSeconds / totalTraditionalSeconds) * 100)
      : 0;

  const actionLabel: Record<string, string> = {
    swap: "Token Swap",
    jupiterSwap: "Jupiter Swap",
    addLiquidity: "Add Liquidity",
    removeLiquidity: "Remove Liquidity",
    liquidityPool: "Liquidity Pool",
    stake: "Stake SOL",
    claim: "Claim Rewards",
    bridge: "BTC Bridge",
    lightning: "SOL Transfer",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="material-icons text-green-500">timer</span>
            Execution Time Comparison
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {workflowName} — see how much time DEX WorkflowVerse saved you
          </p>
        </DialogHeader>

        {/* Summary banner */}
        <div className="rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Traditional</p>
            <p className="text-3xl font-bold text-red-400">{formatTime(totalTraditionalSeconds)}</p>
            <p className="text-xs text-muted-foreground mt-1">manual operations</p>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <div className="h-px w-10 bg-muted-foreground" />
              <span className="material-icons text-green-500 text-2xl">flash_on</span>
              <div className="h-px w-10 bg-muted-foreground" />
            </div>
            <span className="text-xs text-muted-foreground">vs</span>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">DEX WorkflowVerse</p>
            <p className="text-3xl font-bold text-green-400">{formatMs(totalDurationMs)}</p>
            <p className="text-xs text-muted-foreground mt-1">automated workflow</p>
          </div>

          <div className="text-center sm:text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Time Saved</p>
            <p className="text-3xl font-bold text-blue-400">{savedPercent}%</p>
            <p className="text-xs text-muted-foreground mt-1">{formatTime(Math.max(0, Math.round(savedSeconds)))} faster</p>
          </div>
        </div>

        {/* Visual bar comparison */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Time Distribution</p>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-32 shrink-0">Manual</span>
              <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-400 rounded-full transition-all"
                  style={{ width: "100%" }}
                />
              </div>
              <span className="text-xs font-medium w-16 text-right">{formatTime(totalTraditionalSeconds)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-32 shrink-0">WorkflowVerse</span>
              <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-400 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (totalDexSeconds / totalTraditionalSeconds) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-xs font-medium w-16 text-right">{formatMs(totalDurationMs)}</span>
            </div>
          </div>
        </div>

        {/* Operation Guides Button */}
        <div className="pt-6">
          <Button 
            variant="outline" 
            className="w-full mb-6"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-operation-manual'));
            }}
          >
            📚 View Operation Guides & Documentation
          </Button>
        </div>

        {/* Per-action breakdown */}
        {rows.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Per-Action Breakdown</p>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Action</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-red-400">Manual</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-green-400">WorkflowVerse</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-blue-400">Saved</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const dexTime = successfulActions[i]?.durationMs
                      ? successfulActions[i].durationMs!
                      : totalDurationMs / rows.length;
                    const pct = Math.round(
                      ((row.traditionalSeconds - dexTime / 1000) / row.traditionalSeconds) * 100
                    );
                    return (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <p className="font-medium capitalize">
                            {actionLabel[row.type] || row.type}
                          </p>
                          <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                            {row.description}
                          </p>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="mt-1 h-6 px-2 text-xs"
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('open-operation-manual', { detail: row.type }));
                            }}
                          >
                            View Guide
                          </Button>
                        </td>
                        <td className="px-4 py-3 text-center text-red-400 font-medium">
                          {row.traditionalLabel}
                        </td>
                        <td className="px-4 py-3 text-center text-green-400 font-medium">
                          {formatMs(dexTime)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 text-blue-400 font-medium">
                            <span className="material-icons text-xs">trending_down</span>
                            {pct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 border-t border-border font-medium">
                    <td className="px-4 py-2 text-xs">Total</td>
                    <td className="px-4 py-2 text-center text-xs text-red-400">
                      {formatTime(totalTraditionalSeconds)}
                    </td>
                    <td className="px-4 py-2 text-center text-xs text-green-400">
                      {formatMs(totalDurationMs)}
                    </td>
                    <td className="px-4 py-2 text-center text-xs text-blue-400">
                      {savedPercent}% faster
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={onClose} className="bg-primary hover:bg-primary/90">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
