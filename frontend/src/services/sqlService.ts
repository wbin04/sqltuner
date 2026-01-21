/**
 * SQL Service
 * Handles SQL execution, explanation, and optimization
 */
import axios from '../lib/axios';

export interface SQLExecuteRequest {
  connection_id: string;
  sql: string;
}

export interface SQLExecuteResponse {
  columns: string[];
  rows: Record<string, any>[];
  execution_time_ms: number;
  row_count: number;
}

export interface SQLExplainPlanRequest {
  connection_id: string;
  sql: string;
}

export interface SQLExplainPlanResponse {
  plan: Record<string, any>;
  total_cost: number;
  execution_time_ms?: number;
}

export interface SQLOptimizeRequest {
  connection_id: string;
  sql_query: string;
  include_explain?: boolean;
}

export interface SQLOptimizeResponse {
  original_sql: string;
  optimized_sql: string;
  explanation: string;
  index_recommendation?: string;
  stats_comparison?: {
    old_cost: number;
    new_cost: number;
    improvement_percent: number;
  };
}

export const sqlService = {
  /**
   * Execute SQL query on real database
   */
  async execute(request: SQLExecuteRequest): Promise<SQLExecuteResponse> {
    const response = await axios.post<SQLExecuteResponse>(
      '/sql/execute',
      request
    );
    return response.data;
  },

  /**
   * Run EXPLAIN analysis on SQL query
   */
  async explain(request: SQLExplainPlanRequest): Promise<SQLExplainPlanResponse> {
    const response = await axios.post<SQLExplainPlanResponse>(
      '/sql/explain',
      request
    );
    return response.data;
  },

  /**
   * Optimize SQL query using LLM
   */
  async optimize(request: SQLOptimizeRequest): Promise<SQLOptimizeResponse> {
    const response = await axios.post<SQLOptimizeResponse>(
      '/sql/optimize',
      request
    );
    return response.data;
  },
};
