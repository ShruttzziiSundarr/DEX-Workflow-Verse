import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ExecutionRecord {
  id: string;
  timestamp: Date;
  workflowName: string;
  status: 'success' | 'failed' | 'pending';
  actions: {
    type: string;
    status: 'success' | 'failed' | 'pending';
    message: string;
    signature?: string;
    details?: Record<string, any>;
  }[];
  totalDuration?: number;
}

// Global execution history store
const executionHistory: ExecutionRecord[] = [];

export function addExecutionRecord(record: ExecutionRecord) {
  executionHistory.unshift(record); // Add to beginning
  if (executionHistory.length > 50) {
    executionHistory.pop(); // Keep max 50 records
  }
  // Trigger update event
  window.dispatchEvent(new CustomEvent('execution-history-updated'));
}

export function getExecutionHistory(): ExecutionRecord[] {
  return [...executionHistory];
}

export function ExecutionHistory() {
  const [history, setHistory] = useState<ExecutionRecord[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const updateHistory = () => {
      setHistory(getExecutionHistory());
    };

    updateHistory();
    window.addEventListener('execution-history-updated', updateHistory);

    return () => {
      window.removeEventListener('execution-history-updated', updateHistory);
    };
  }, []);

  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 bg-dark-200 border border-dark-100 hover:bg-dark-300"
        >
          <span className="material-icons text-sm">history</span>
          <span>Execution History</span>
          {history.length > 0 && (
            <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full">
              {history.length}
            </span>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      <Card className="bg-dark-200 border border-dark-100 shadow-xl">
        <div className="p-3 border-b border-dark-100 flex items-center justify-between">
          <h3 className="font-medium flex items-center gap-2">
            <span className="material-icons text-sm">history</span>
            Execution History
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
          >
            <span className="material-icons text-sm">close</span>
          </Button>
        </div>

        <ScrollArea className="h-80">
          {history.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <span className="material-icons text-4xl mb-2">inbox</span>
              <p>No executions yet</p>
              <p className="text-xs mt-1">Execute a workflow to see history here</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {history.map((record) => (
                <ExecutionRecordCard key={record.id} record={record} />
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>
    </div>
  );
}

function ExecutionRecordCard({ record }: { record: ExecutionRecord }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusColor = {
    success: 'text-green-500',
    failed: 'text-red-500',
    pending: 'text-yellow-500',
  }[record.status];

  const statusIcon = {
    success: 'check_circle',
    failed: 'error',
    pending: 'hourglass_empty',
  }[record.status];

  return (
    <Card className="bg-dark-300 border border-dark-100 p-3">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className={`material-icons text-sm ${statusColor}`}>
            {statusIcon}
          </span>
          <div>
            <p className="font-medium text-sm">{record.workflowName}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(record.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>
        <span className="material-icons text-sm text-muted-foreground">
          {isExpanded ? 'expand_less' : 'expand_more'}
        </span>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-dark-100 space-y-2">
          {record.actions.map((action, index) => (
            <div key={index} className="text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`material-icons text-xs ${
                    action.status === 'success'
                      ? 'text-green-500'
                      : action.status === 'failed'
                      ? 'text-red-500'
                      : 'text-yellow-500'
                  }`}
                >
                  {action.status === 'success'
                    ? 'check'
                    : action.status === 'failed'
                    ? 'close'
                    : 'pending'}
                </span>
                <span className="font-medium capitalize">{action.type}</span>
              </div>
              <p className="text-muted-foreground ml-5">{action.message}</p>
              {action.signature && (
                <a
                  href={`https://explorer.solana.com/tx/${action.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-5 text-primary hover:underline flex items-center gap-1"
                >
                  <span>View on Explorer</span>
                  <span className="material-icons text-xs">open_in_new</span>
                </a>
              )}
              {action.details && (
                <div className="ml-5 mt-1 p-2 bg-dark-200 rounded text-xs">
                  {Object.entries(action.details).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground">{key}:</span>
                      <span>{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {record.totalDuration && (
            <div className="text-xs text-muted-foreground pt-2 border-t border-dark-100">
              Total time: {(record.totalDuration / 1000).toFixed(2)}s
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
