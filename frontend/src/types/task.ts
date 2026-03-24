/**
 * Background Task Types
 * Type definitions for async task processing with Google Cloud Tasks
 */

export enum TaskStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum TaskType {
  LLM_OPTIMIZE = 'llm_optimize',
  SQLITE_SANDBOX = 'sqlite_sandbox',
  SCHEMA_SYNC = 'schema_sync',
}

/**
 * Backend task record
 */
export interface BackgroundTask {
  id: string;
  user_id: string;
  task_type: TaskType;
  status: TaskStatus;
  payload: Record<string, any>;
  result?: Record<string, any> | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Response từ task polling endpoint
 */
export interface TaskStatusResponse {
  id: string;
  user_id: string;
  task_type: TaskType;
  status: TaskStatus;
  payload: Record<string, any>;
  result?: Record<string, any> | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Request để tạo task mới (internal use)
 */
export interface TaskCreateRequest {
  task_type: TaskType;
  payload: Record<string, any>;
}

/**
 * Response khi enqueue task thành công
 */
export interface TaskEnqueueResponse {
  task_id: string;
  status: TaskStatus;
  message: string;
}

/**
 * Typed result cho LLM optimization task
 */
export interface LLMOptimizeResult {
  optimized_query: string;
  explanation: string;
  recommendations?: string[];
}

/**
 * Typed result cho SQLite sandbox task
 */
export interface SQLiteSandboxResult {
  execution_time_ms: number;
  rows_affected: number;
  result_set: any[];
}

/**
 * Typed result cho Schema sync task
 */
export interface SchemaSyncResult {
  tables_synced: number;
  schema: Record<string, any>;
}

/**
 * Polling options
 */
export interface TaskPollingOptions {
  interval?: number; // Poll interval in ms (default: 2000)
  maxAttempts?: number; // Max polling attempts (default: 60)
  onStatusChange?: (status: TaskStatus) => void;
  onProgress?: (task: TaskStatusResponse) => void;
}
