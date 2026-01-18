/**
 * Core Type Definitions for SQLTuner Application
 */

// ============ User & Auth ============
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
}

// ============ Database Connections ============
export interface DBConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  db_password?: string; // Optional for security
  db_name: string;
  db_type: 'postgres' | 'mysql' | 'sqlite';
  status?: 'online' | 'offline' | 'testing';
  createdAt?: string;
  updatedAt?: string;
}

// Deprecated - keeping for backwards compatibility
export interface Workspace {
  id: string;
  name: string;
  type: 'real' | 'simulation';
  tableCount: number;
  lastSync: string;
  status: 'active' | 'idle' | 'error';
  description?: string;
}

// ============ Conversations & Query Logs ============
export interface Conversation {
  id: string;
  connection_id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface QueryLog {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  sql_generated?: string;
  createdAt: string;
}

// ============ Feedback (RLHF) ============
export interface Feedback {
  id: string;
  query_log_id: string;
  rating: 0 | 1; // 0 = thumbs down, 1 = thumbs up
  corrected_sql?: string;
  comment?: string;
  createdAt: string;
}

// ============ Performance Analysis ============
export interface PerformanceAnalysis {
  id: string;
  query_log_id: string;
  execution_time_ms: number;
  total_cost: number;
  explain_plan: ExplainPlanNode; // JSONB
  index_recommendation?: string;
  createdAt: string;
}

export interface ExplainPlanNode {
  'Node Type': string;
  'Startup Cost': number;
  'Total Cost': number;
  'Plan Rows': number;
  'Plan Width': number;
  'Actual Rows'?: number;
  'Actual Loops'?: number;
  'Relation Name'?: string;
  'Index Name'?: string;
  Plans?: ExplainPlanNode[];
}

// ============ Schema Information ============
export interface TableSchema {
  table_name: string;
  columns: ColumnSchema[];
  indexes?: IndexSchema[];
  row_count?: number;
}

export interface ColumnSchema {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default?: string;
  is_primary_key?: boolean;
  is_foreign_key?: boolean;
}

export interface IndexSchema {
  index_name: string;
  columns: string[];
  is_unique: boolean;
  index_type: string;
}

// ============ Query Results ============
export interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  executionTime?: number;
}
