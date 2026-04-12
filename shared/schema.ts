import { pgTable, text, serial, integer, jsonb, timestamp, doublePrecision, bigint, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  walletAddress: text("wallet_address"),
});

export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  nodes: jsonb("nodes").notNull().$type<WorkflowNode[]>(),
  edges: jsonb("edges").notNull().$type<WorkflowEdge[]>(),
  created: text("created").notNull(),
  updated: text("updated").notNull(),
});

// New table for storing workflow actions
export const workflowActions = pgTable("workflow_actions", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").references(() => workflows.id).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  config: jsonb("config").notNull().$type<Record<string, any>>(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// LP positions table — persists user liquidity positions across sessions
export const lpPositions = pgTable("lp_positions", {
  id: serial("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  poolAddress: text("pool_address").notNull(),
  lpBalance: doublePrecision("lp_balance").notNull().default(0),
  sharePercentage: doublePrecision("share_percentage").notNull().default(0),
  tokenAValue: doublePrecision("token_a_value").notNull().default(0),
  tokenBValue: doublePrecision("token_b_value").notNull().default(0),
  valueUsd: doublePrecision("value_usd").notNull().default(0),
  createdAt: bigint("created_at", { mode: 'number' }).notNull(),
  lastClaimedAt: bigint("last_claimed_at", { mode: 'number' }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  walletPoolUniq: uniqueIndex("lp_positions_wallet_pool_uniq").on(table.walletAddress, table.poolAddress),
}));

// New table for workflow execution history
export const workflowExecutions = pgTable("workflow_executions", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").references(() => workflows.id).notNull(),
  status: text("status").notNull(), // pending, running, completed, failed
  result: jsonb("result").$type<Record<string, any> | null>(),
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  walletAddress: true,
});

export const insertWorkflowSchema = createInsertSchema(workflows).pick({
  userId: true,
  name: true,
  description: true,
  nodes: true,
  edges: true,
  created: true,
  updated: true,
});

export const insertWorkflowActionSchema = createInsertSchema(workflowActions).pick({
  workflowId: true,
  name: true,
  type: true,
  config: true,
  order: true,
});

export const insertWorkflowExecutionSchema = createInsertSchema(workflowExecutions).pick({
  workflowId: true,
  status: true,
});

export const insertLpPositionSchema = createInsertSchema(lpPositions).omit({ id: true, updatedAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;

export type InsertWorkflowAction = z.infer<typeof insertWorkflowActionSchema>;
export type WorkflowAction = typeof workflowActions.$inferSelect;

export type InsertWorkflowExecution = z.infer<typeof insertWorkflowExecutionSchema>;
export type WorkflowExecution = typeof workflowExecutions.$inferSelect;

export type InsertLpPosition = z.infer<typeof insertLpPositionSchema>;
export type LpPosition = typeof lpPositions.$inferSelect;

// Module types for workflow
export const ModuleTypeEnum = z.enum([
  "swap",
  "liquidityPool",
  "addLiquidity",
  "removeLiquidity",
  "stake",
  "claim",
  "bridge",
  "lightning",
  "orcaSwap",
  "raydiumSwap",
  "tokenCreation",
]);

export type ModuleType = z.infer<typeof ModuleTypeEnum>;

// Action types for workflow
export const ActionTypeEnum = z.enum([
  "httpRequest",
  "smartContractCall",
  "emailSend",
  "defiSwap",
  "addLiquidity",
  "removeLiquidity",
  "tokenTransfer"
]);

export type ActionType = z.infer<typeof ActionTypeEnum>;

// Define workflow node and edge types for better type safety with jsonb
export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    type: ModuleType;
    config?: Record<string, any>;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
}

// Define execution status types
export const ExecutionStatusEnum = z.enum([
  "pending",
  "running",
  "completed",
  "failed"
]);

export type ExecutionStatus = z.infer<typeof ExecutionStatusEnum>;
