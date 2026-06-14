/**
 * Optimization Types
 * Type definitions for SQL optimization feature
 */

export interface StatsComparison {
  metric_type: 'execution_time' | 'planner_cost';
  original_time_ms: number | null;
  optimized_time_ms: number | null;
  improvement_percent: number;
  speedup_factor: number | null;
  // backward compat
  old_cost?: number | null;
  new_cost?: number | null;
}

export interface OptimizationAnalysis {
  original_cost: number | null;
  bottlenecks: string[];
  optimized_sql: string;
  index_recommendation?: string;
  explanation: string;
  rewrite_type?: string | null;
  changes_made?: string[];
  stats_comparison?: StatsComparison;
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
  index_recommendation?: string | null;
  rewrite_type?: string | null;
  changes_made?: string[];
  bottlenecks?: string[];
  stats_comparison?: StatsComparison | null;
  query_log_id?: string | null;
}

export type RewriteType =
  | 'none'
  | 'select_columns'
  | 'subquery_to_join'
  | 'function_on_column'
  | 'leading_wildcard'
  | 'distinct_to_group'
  | 'union_rewrite'
  | 'multiple';

export const REWRITE_TYPE_LABELS: Record<RewriteType, string> = {
  none: 'No rewrite needed',
  select_columns: 'Column projection',
  subquery_to_join: 'Subquery -> JOIN',
  function_on_column: 'Function removed',
  leading_wildcard: 'LIKE pattern',
  distinct_to_group: 'DISTINCT -> GROUP BY',
  union_rewrite: 'OR -> UNION ALL',
  multiple: 'Multiple rewrites',
};

export const REWRITE_TYPE_COLORS: Record<RewriteType, string> = {
  none: 'bg-gray-100 text-gray-600',
  select_columns: 'bg-blue-100 text-blue-700',
  subquery_to_join: 'bg-orange-100 text-orange-700',
  function_on_column: 'bg-red-100 text-red-700',
  leading_wildcard: 'bg-red-100 text-red-700',
  distinct_to_group: 'bg-yellow-100 text-yellow-700',
  union_rewrite: 'bg-purple-100 text-purple-700',
  multiple: 'bg-pink-100 text-pink-700',
};
