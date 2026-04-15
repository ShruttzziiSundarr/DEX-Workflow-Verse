import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;

// Determine if we should use Memory mode instead of PostgreSQL
export const isMemoryMode = 
  !DATABASE_URL || 
  DATABASE_URL === 'memory' || 
  DATABASE_URL.startsWith('sqlite') || 
  !DATABASE_URL.startsWith('postgres');

if (isMemoryMode) {
  console.log('[DB] Running in memory mode. Data will not persist across restarts.');
} else {
  console.log('[DB] Connecting to PostgreSQL (Neon)...');
}

// Export the pool and db conditionally without throwing an error
export const pool = isMemoryMode ? null : new Pool({ connectionString: DATABASE_URL });
export const db = isMemoryMode || !pool ? null : drizzle(pool, { schema });