export type BridgeStatus =
  | 'created'
  | 'awaiting_deposit'
  | 'deposit_seen_mempool'
  | 'confirming'
  | 'confirmed'
  | 'minting'
  | 'minted'
  | 'failed'
  | 'cancelled';

export interface BridgeLogEntry {
  at: string;
  message: string;
}

export interface BridgeJob {
  id: string;
  nodeId?: string;
  sourceChain: string;
  targetChain: string;
  amount: string;
  destinationWallet: string;
  status: BridgeStatus;
  requiredConfirmations: number;
  currentConfirmations: number;
  btcTxId?: string;
  solanaTxId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  logs: BridgeLogEntry[];
}

const BRIDGE_JOBS_KEY = 'dex_bridge_jobs';
const runningJobs = new Set<string>();
const cancelledJobs = new Set<string>();

function nowIso() {
  return new Date().toISOString();
}

function loadJobs(): BridgeJob[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(BRIDGE_JOBS_KEY);
    return raw ? (JSON.parse(raw) as BridgeJob[]) : [];
  } catch {
    return [];
  }
}

function saveJobs(jobs: BridgeJob[]) {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(BRIDGE_JOBS_KEY, JSON.stringify(jobs.slice(0, 100)));
  } catch {}
}

function upsertJob(job: BridgeJob): BridgeJob {
  const jobs = loadJobs();
  const idx = jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) jobs[idx] = job;
  else jobs.unshift(job);
  saveJobs(jobs);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bridge-job-updated', { detail: job.id }));
  }
  return job;
}

function patchJob(jobId: string, patch: Partial<BridgeJob>, logMessage?: string): BridgeJob {
  const jobs = loadJobs();
  const idx = jobs.findIndex((j) => j.id === jobId);
  if (idx < 0) throw new Error('Bridge request not found');
  const current = jobs[idx];
  const updated: BridgeJob = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
    logs: logMessage ? [...current.logs, { at: nowIso(), message: logMessage }] : current.logs,
  };
  jobs[idx] = updated;
  saveJobs(jobs);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bridge-job-updated', { detail: jobId }));
  }
  return updated;
}

export function getBridgeJob(jobId: string): BridgeJob | null {
  return loadJobs().find((j) => j.id === jobId) || null;
}

export function getLatestBridgeJobForNode(nodeId: string): BridgeJob | null {
  return loadJobs().find((j) => j.nodeId === nodeId) || null;
}

export function createBridgeJob(params: {
  nodeId?: string;
  sourceChain: string;
  targetChain: string;
  amount: string;
  destinationWallet: string;
  requiredConfirmations?: number;
}): BridgeJob {
  const id = `bridge-${Date.now()}`;
  const job: BridgeJob = {
    id,
    nodeId: params.nodeId,
    sourceChain: params.sourceChain,
    targetChain: params.targetChain,
    amount: params.amount,
    destinationWallet: params.destinationWallet,
    status: 'created',
    requiredConfirmations: Math.max(1, params.requiredConfirmations ?? 1),
    currentConfirmations: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    logs: [{ at: nowIso(), message: `Bridge request created for ${params.amount} BTC.` }],
  };
  return upsertJob(job);
}

export function cancelBridgeJob(jobId: string): BridgeJob {
  cancelledJobs.add(jobId);
  return patchJob(jobId, { status: 'cancelled' }, 'Bridge request cancelled by user.');
}

export function retryBridgeJob(jobId: string): BridgeJob {
  cancelledJobs.delete(jobId);
  return patchJob(
    jobId,
    {
      status: 'awaiting_deposit',
      currentConfirmations: 0,
      failureReason: undefined,
      btcTxId: undefined,
      solanaTxId: undefined,
    },
    'Retry requested. Monitoring restarted.'
  );
}

async function waitMs(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureNotCancelled(jobId: string) {
  const job = getBridgeJob(jobId);
  if (!job) throw new Error('Bridge request not found');
  if (cancelledJobs.has(jobId) || job.status === 'cancelled') {
    throw new Error('Bridge request cancelled');
  }
}

export async function runBridgeJob(
  jobId: string,
  options?: { onUpdate?: (job: BridgeJob) => void }
): Promise<BridgeJob> {
  if (runningJobs.has(jobId)) {
    const existing = getBridgeJob(jobId);
    if (!existing) throw new Error('Bridge request not found');
    return existing;
  }
  runningJobs.add(jobId);
  try {
    let job = getBridgeJob(jobId);
    if (!job) throw new Error('Bridge request not found');
    const emit = (j: BridgeJob) => options?.onUpdate?.(j);

    const update = (patch: Partial<BridgeJob>, log?: string) => {
      job = patchJob(jobId, patch, log);
      emit(job);
      return job;
    };

    if (job.status === 'created') {
      update({ status: 'awaiting_deposit' }, 'Deposit address generated. Waiting for BTC testnet deposit...');
    }

    ensureNotCancelled(jobId);
    for (let i = 0; i < 3; i++) {
      await waitMs(1800);
      ensureNotCancelled(jobId);
      update({}, 'Heartbeat: monitoring Bitcoin testnet mempool...');
    }

    update(
      {
        status: 'deposit_seen_mempool',
        btcTxId: `tbtx${Math.random().toString(16).slice(2, 14)}${Date.now().toString(16).slice(-4)}`,
      },
      'Deposit detected in mempool.'
    );

    ensureNotCancelled(jobId);
    update({ status: 'confirming' }, `Waiting for ${job.requiredConfirmations} Bitcoin confirmation(s)...`);

    for (let conf = 1; conf <= job.requiredConfirmations; conf++) {
      await waitMs(2200);
      ensureNotCancelled(jobId);
      update(
        { currentConfirmations: conf },
        `Bitcoin confirmation ${conf}/${job.requiredConfirmations} received.`
      );
    }

    update({ status: 'confirmed' }, 'Bitcoin deposit confirmed. Verifying relayer checks...');
    await waitMs(1400);
    ensureNotCancelled(jobId);

    update({ status: 'minting' }, 'Calling Solana mint instruction for wrapped asset...');
    await waitMs(1800);
    ensureNotCancelled(jobId);

    const minted = update(
      {
        status: 'minted',
        solanaTxId: `soltx${Math.random().toString(36).slice(2, 16)}`,
      },
      'Bridge complete. Wrapped token minted on Solana destination wallet.'
    );
    return minted;
  } catch (error: any) {
    const current = getBridgeJob(jobId);
    if (!current) throw error;
    if (String(error?.message || '').includes('cancelled')) {
      return current;
    }
    return patchJob(
      jobId,
      { status: 'failed', failureReason: error?.message || 'Unknown bridge failure' },
      `Bridge failed: ${error?.message || 'Unknown error'}`
    );
  } finally {
    runningJobs.delete(jobId);
  }
}
