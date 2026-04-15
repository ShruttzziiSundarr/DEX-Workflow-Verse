import { users, workflows, workflowActions, workflowExecutions, lpPositions,
  type User, type InsertUser, type Workflow, type InsertWorkflow,
  type WorkflowAction, type InsertWorkflowAction,
  type WorkflowExecution, type InsertWorkflowExecution,
  type LpPosition, type InsertLpPosition,
  type ExecutionStatus
} from "@shared/schema";
import { isMemoryMode, db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Workflow methods
  getWorkflows(): Promise<Workflow[]>;
  getWorkflow(id: number): Promise<Workflow | undefined>;
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: number, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined>;
  deleteWorkflow(id: number): Promise<boolean>;

  // Workflow Actions methods
  getWorkflowActions(workflowId: number): Promise<WorkflowAction[]>;
  createWorkflowAction(action: InsertWorkflowAction): Promise<WorkflowAction>;
  updateWorkflowAction(id: number, action: Partial<InsertWorkflowAction>): Promise<WorkflowAction | undefined>;
  deleteWorkflowAction(id: number): Promise<boolean>;
  
  // Workflow Execution methods
  getWorkflowExecutions(workflowId: number): Promise<WorkflowExecution[]>;
  getWorkflowExecution(id: number): Promise<WorkflowExecution | undefined>;
  createWorkflowExecution(execution: InsertWorkflowExecution): Promise<WorkflowExecution>;
  updateWorkflowExecutionStatus(id: number, status: ExecutionStatus, result?: Record<string, any>, error?: string): Promise<WorkflowExecution | undefined>;

  // LP Position methods
  getLPPositions(walletAddress: string): Promise<LpPosition[]>;
  upsertLPPosition(position: InsertLpPosition): Promise<LpPosition>;
  deleteLPPosition(walletAddress: string, poolAddress: string): Promise<boolean>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY STORAGE — works without any database
// ═══════════════════════════════════════════════════════════════════════════════

export class MemoryStorage implements IStorage {
  private usersMap = new Map<number, User>();
  private workflowsMap = new Map<number, Workflow>();
  private actionsMap = new Map<number, WorkflowAction>();
  private executionsMap = new Map<number, WorkflowExecution>();
  private lpPositionsMap = new Map<string, LpPosition>(); // key = wallet:pool
  private nextId = { user: 1, workflow: 1, action: 1, execution: 1, lp: 1 };

  // ── Users ──
  async getUser(id: number) { return this.usersMap.get(id); }
  async getUserByUsername(username: string) {
    return [...this.usersMap.values()].find(u => u.username === username);
  }
  async createUser(user: InsertUser): Promise<User> {
    const id = this.nextId.user++;
    const newUser: User = { id, username: user.username, password: user.password, walletAddress: user.walletAddress ?? null };
    this.usersMap.set(id, newUser);
    return newUser;
  }

  // ── Workflows ──
  async getWorkflows() { return [...this.workflowsMap.values()]; }
  async getWorkflow(id: number) { return this.workflowsMap.get(id); }
  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const id = this.nextId.workflow++;
    const newWf: Workflow = {
      id,
      userId: workflow.userId ?? null,
      name: workflow.name,
      description: workflow.description ?? null,
      nodes: workflow.nodes,
      edges: workflow.edges,
      created: workflow.created,
      updated: workflow.updated,
    };
    this.workflowsMap.set(id, newWf);
    return newWf;
  }
  async updateWorkflow(id: number, workflow: Partial<InsertWorkflow>) {
    const existing = this.workflowsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...workflow };
    this.workflowsMap.set(id, updated);
    return updated;
  }
  async deleteWorkflow(id: number) {
    // Delete associated data first
    for (const [aId, action] of this.actionsMap) {
      if (action.workflowId === id) this.actionsMap.delete(aId);
    }
    for (const [eId, exec] of this.executionsMap) {
      if (exec.workflowId === id) this.executionsMap.delete(eId);
    }
    return this.workflowsMap.delete(id);
  }

  // ── Actions ──
  async getWorkflowActions(workflowId: number) {
    return [...this.actionsMap.values()]
      .filter(a => a.workflowId === workflowId)
      .sort((a, b) => a.order - b.order);
  }
  async createWorkflowAction(action: InsertWorkflowAction): Promise<WorkflowAction> {
    const id = this.nextId.action++;
    const newAction: WorkflowAction = {
      id,
      workflowId: action.workflowId,
      name: action.name,
      type: action.type,
      config: action.config,
      order: action.order,
      createdAt: new Date(),
    };
    this.actionsMap.set(id, newAction);
    return newAction;
  }
  async updateWorkflowAction(id: number, action: Partial<InsertWorkflowAction>) {
    const existing = this.actionsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...action };
    this.actionsMap.set(id, updated);
    return updated;
  }
  async deleteWorkflowAction(id: number) { return this.actionsMap.delete(id); }

  // ── Executions ──
  async getWorkflowExecutions(workflowId: number) {
    return [...this.executionsMap.values()]
      .filter(e => e.workflowId === workflowId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }
  async getWorkflowExecution(id: number) { return this.executionsMap.get(id); }
  async createWorkflowExecution(execution: InsertWorkflowExecution): Promise<WorkflowExecution> {
    const id = this.nextId.execution++;
    const newExec: WorkflowExecution = {
      id,
      workflowId: execution.workflowId,
      status: execution.status,
      result: null,
      error: null,
      startedAt: new Date(),
      completedAt: null,
    };
    this.executionsMap.set(id, newExec);
    return newExec;
  }
  async updateWorkflowExecutionStatus(id: number, status: ExecutionStatus, result?: Record<string, any>, error?: string) {
    const existing = this.executionsMap.get(id);
    if (!existing) return undefined;
    const updated: WorkflowExecution = {
      ...existing,
      status,
      result: result ?? existing.result,
      error: error ?? existing.error,
      completedAt: (status === 'completed' || status === 'failed') ? new Date() : existing.completedAt,
    };
    this.executionsMap.set(id, updated);
    return updated;
  }

  // ── LP Positions ──
  async getLPPositions(walletAddress: string) {
    return [...this.lpPositionsMap.values()].filter(p => p.walletAddress === walletAddress);
  }
  async upsertLPPosition(position: InsertLpPosition): Promise<LpPosition> {
    const key = `${position.walletAddress}:${position.poolAddress}`;
    const existing = this.lpPositionsMap.get(key);
    const id = existing?.id ?? this.nextId.lp++;
    const lp: LpPosition = {
      id,
      walletAddress: position.walletAddress,
      poolAddress: position.poolAddress,
      lpBalance: position.lpBalance,
      sharePercentage: position.sharePercentage,
      tokenAValue: position.tokenAValue,
      tokenBValue: position.tokenBValue,
      valueUsd: position.valueUsd,
      createdAt: position.createdAt,
      lastClaimedAt: position.lastClaimedAt,
      updatedAt: new Date(),
    };
    this.lpPositionsMap.set(key, lp);
    return lp;
  }
  async deleteLPPosition(walletAddress: string, poolAddress: string) {
    return this.lpPositionsMap.delete(`${walletAddress}:${poolAddress}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE STORAGE — PostgreSQL via Drizzle ORM (requires valid DATABASE_URL)
// ═══════════════════════════════════════════════════════════════════════════════

export class DatabaseStorage implements IStorage {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  // Workflow methods
  async getWorkflows(): Promise<Workflow[]> {
    return await this.db.select().from(workflows);
  }
  
  async getWorkflow(id: number): Promise<Workflow | undefined> {
    const [workflow] = await this.db
      .select()
      .from(workflows)
      .where(eq(workflows.id, id));
    return workflow || undefined;
  }
  
  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const [newWorkflow] = await this.db
      .insert(workflows)
      .values(workflow)
      .returning();
    return newWorkflow;
  }
  
  async updateWorkflow(id: number, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined> {
    const [updatedWorkflow] = await this.db
      .update(workflows)
      .set(workflow)
      .where(eq(workflows.id, id))
      .returning();
    return updatedWorkflow || undefined;
  }
  
  async deleteWorkflow(id: number): Promise<boolean> {
    try {
      // Delete associated actions and executions first
      await this.db.delete(workflowActions).where(eq(workflowActions.workflowId, id));
      await this.db.delete(workflowExecutions).where(eq(workflowExecutions.workflowId, id));
      
      // Then delete the workflow
      const [deletedWorkflow] = await this.db
        .delete(workflows)
        .where(eq(workflows.id, id))
        .returning();
      return !!deletedWorkflow;
    } catch (error) {
      console.error("Error deleting workflow:", error);
      return false;
    }
  }
  
  // Workflow Actions methods
  async getWorkflowActions(workflowId: number): Promise<WorkflowAction[]> {
    return await this.db
      .select()
      .from(workflowActions)
      .where(eq(workflowActions.workflowId, workflowId))
      .orderBy(workflowActions.order);
  }
  
  async createWorkflowAction(action: InsertWorkflowAction): Promise<WorkflowAction> {
    const [newAction] = await this.db
      .insert(workflowActions)
      .values(action)
      .returning();
    return newAction;
  }
  
  async updateWorkflowAction(id: number, action: Partial<InsertWorkflowAction>): Promise<WorkflowAction | undefined> {
    const [updatedAction] = await this.db
      .update(workflowActions)
      .set(action)
      .where(eq(workflowActions.id, id))
      .returning();
    return updatedAction || undefined;
  }
  
  async deleteWorkflowAction(id: number): Promise<boolean> {
    const [deletedAction] = await this.db
      .delete(workflowActions)
      .where(eq(workflowActions.id, id))
      .returning();
    return !!deletedAction;
  }
  
  // Workflow Execution methods
  async getWorkflowExecutions(workflowId: number): Promise<WorkflowExecution[]> {
    return await this.db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.workflowId, workflowId))
      .orderBy(desc(workflowExecutions.startedAt));
  }
  
  async getWorkflowExecution(id: number): Promise<WorkflowExecution | undefined> {
    const [execution] = await this.db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.id, id));
    return execution || undefined;
  }
  
  async createWorkflowExecution(execution: InsertWorkflowExecution): Promise<WorkflowExecution> {
    const [newExecution] = await this.db
      .insert(workflowExecutions)
      .values(execution)
      .returning();
    return newExecution;
  }
  
  async updateWorkflowExecutionStatus(
    id: number, 
    status: ExecutionStatus, 
    result?: Record<string, any>, 
    error?: string
  ): Promise<WorkflowExecution | undefined> {
    const updates: any = { status };
    
    if (status === 'completed' || status === 'failed') {
      updates.completedAt = new Date();
    }
    
    if (result) {
      updates.result = result;
    }
    
    if (error) {
      updates.error = error;
    }
    
    const [updatedExecution] = await this.db
      .update(workflowExecutions)
      .set(updates)
      .where(eq(workflowExecutions.id, id))
      .returning();
    
    return updatedExecution || undefined;
  }

  // LP Position methods
  async getLPPositions(walletAddress: string): Promise<LpPosition[]> {
    return await this.db
      .select()
      .from(lpPositions)
      .where(eq(lpPositions.walletAddress, walletAddress));
  }

  async upsertLPPosition(position: InsertLpPosition): Promise<LpPosition> {
    const [row] = await this.db
      .insert(lpPositions)
      .values(position)
      .onConflictDoUpdate({
        target: [lpPositions.walletAddress, lpPositions.poolAddress],
        set: {
          lpBalance: position.lpBalance,
          sharePercentage: position.sharePercentage,
          tokenAValue: position.tokenAValue,
          tokenBValue: position.tokenBValue,
          valueUsd: position.valueUsd,
          lastClaimedAt: position.lastClaimedAt,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async deleteLPPosition(walletAddress: string, poolAddress: string): Promise<boolean> {
    const [deleted] = await this.db
      .delete(lpPositions)
      .where(and(
        eq(lpPositions.walletAddress, walletAddress),
        eq(lpPositions.poolAddress, poolAddress),
      ))
      .returning();
    return !!deleted;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT — choose storage based on environment
// ═══════════════════════════════════════════════════════════════════════════════

let storage: IStorage;

if (isMemoryMode || !db) {
  storage = new MemoryStorage();
  console.log('[Storage] Using in-memory storage');
} else {
  storage = new DatabaseStorage(db);
  console.log('[Storage] Using PostgreSQL database storage');
}

export { storage };
