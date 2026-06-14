/**
 * TypeScript types for History/Query Logs
 */

export interface WorkspaceInfo {
  id: string;
  name: string;
  db_type: 'postgres' | 'mysql' | 'simulation';
}

export type ActivityType = 'optimization' | 'execution' | 'chat';
export type ResultStatus = 'success' | 'error' | 'optimized';

export interface HistoryLog {
  id: string;
  timestamp: string;
  workspace: WorkspaceInfo;
  activity_type: ActivityType;
  user_prompt?: string;
  sql_query?: string;
  result_status?: ResultStatus;
  cost_reduction?: number;
  execution_time_ms?: number;
}

export interface HistoryDetail {
  id: string;
  timestamp: string;
  workspace: WorkspaceInfo;
  activity_type: ActivityType;
  user_prompt?: string;
  sql_query?: string;
  ai_response?: string;
  result_status?: ResultStatus;
  execution_time_ms?: number;
  total_cost?: number;        // backward compat (planner cost)
  original_time_ms?: number | null;   // MỚI: actual exec time of original query (ms)
  optimized_time_ms?: number | null;  // MỚI: actual exec time of optimized query (ms)
  explain_plan?: Record<string, any>;
  index_recommendation?: string;
  conversation_id: string;
}

export interface HistoryListResponse {
  total: number;
  page: number;
  limit: number;
  items: HistoryLog[];
}

export interface HistoryFilter {
  page?: number;
  limit?: number;
  search?: string;
  workspace_id?: string;
  activity_type?: ActivityType;
}
