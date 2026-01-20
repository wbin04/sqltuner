/**
 * Optimization Types
 * Type definitions for SQL optimization feature
 */

export interface OptimizationAnalysis {
  original_cost: number | null;
  bottlenecks: string[];
  optimized_sql: string;
  index_recommendation?: string;
  explanation: string;
  stats_comparison?: {
    old_cost: number;
    new_cost: number;
    improvement_percent: number;
  };
}

export interface OptimizationRequest {
  connection_id: string;
  sql_query: string;
  include_explain?: boolean;
}

export interface OptimizationResponse {
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
