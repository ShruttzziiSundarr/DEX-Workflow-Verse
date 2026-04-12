import { users, workflows, workflowActions, workflowExecutions, lpPositions,
  type User, type InsertUser, type Workflow, type InsertWorkflow,
  type WorkflowAction, type InsertWorkflowAction,
  type WorkflowExecution, type InsertWorkflowExecution,
  type LpPosition, type InsertLpPosition,
  type ExecutionStatus
} from "@shared/schema";
import { db } from "./db";
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

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  // Workflow methods
  async getWorkflows(): Promise<Workflow[]> {
    return await db.select().from(workflows);
  }
  
  async getWorkflow(id: number): Promise<Workflow | undefined> {
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, id));
    return workflow || undefined;
  }
  
  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const [newWorkflow] = await db
      .insert(workflows)
      .values(workflow)
      .returning();
    return newWorkflow;
  }
  
  async updateWorkflow(id: number, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined> {
    const [updatedWorkflow] = await db
      .update(workflows)
      .set(workflow)
      .where(eq(workflows.id, id))
      .returning();
    return updatedWorkflow || undefined;
  }
  
  async deleteWorkflow(id: number): Promise<boolean> {
    try {
      // Delete associated actions and executions first
      await db.delete(workflowActions).where(eq(workflowActions.workflowId, id));
      await db.delete(workflowExecutions).where(eq(workflowExecutions.workflowId, id));
      
      // Then delete the workflow
      const [deletedWorkflow] = await db
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
    return await db
      .select()
      .from(workflowActions)
      .where(eq(workflowActions.workflowId, workflowId))
      .orderBy(workflowActions.order);
  }
  
  async createWorkflowAction(action: InsertWorkflowAction): Promise<WorkflowAction> {
    const [newAction] = await db
      .insert(workflowActions)
      .values(action)
      .returning();
    return newAction;
  }
  
  async updateWorkflowAction(id: number, action: Partial<InsertWorkflowAction>): Promise<WorkflowAction | undefined> {
    const [updatedAction] = await db
      .update(workflowActions)
      .set(action)
      .where(eq(workflowActions.id, id))
      .returning();
    return updatedAction || undefined;
  }
  
  async deleteWorkflowAction(id: number): Promise<boolean> {
    const [deletedAction] = await db
      .delete(workflowActions)
      .where(eq(workflowActions.id, id))
      .returning();
    return !!deletedAction;
  }
  
  // Workflow Execution methods
  async getWorkflowExecutions(workflowId: number): Promise<WorkflowExecution[]> {
    return await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.workflowId, workflowId))
      .orderBy(desc(workflowExecutions.startedAt));
  }
  
  async getWorkflowExecution(id: number): Promise<WorkflowExecution | undefined> {
    const [execution] = await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.id, id));
    return execution || undefined;
  }
  
  async createWorkflowExecution(execution: InsertWorkflowExecution): Promise<WorkflowExecution> {
    const [newExecution] = await db
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
    
    const [updatedExecution] = await db
      .update(workflowExecutions)
      .set(updates)
      .where(eq(workflowExecutions.id, id))
      .returning();
    
    return updatedExecution || undefined;
  }

  // LP Position methods
  async getLPPositions(walletAddress: string): Promise<LpPosition[]> {
    return await db
      .select()
      .from(lpPositions)
      .where(eq(lpPositions.walletAddress, walletAddress));
  }

  async upsertLPPosition(position: InsertLpPosition): Promise<LpPosition> {
    const [row] = await db
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
    const [deleted] = await db
      .delete(lpPositions)
      .where(and(
        eq(lpPositions.walletAddress, walletAddress),
        eq(lpPositions.poolAddress, poolAddress),
      ))
      .returning();
    return !!deleted;
  }
}

export const storage = new DatabaseStorage();
