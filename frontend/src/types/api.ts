export interface HealthResponse {
  status: string;
  project_name: string;
  model_name: string;
  model_available: boolean;
}

export interface SQLOptimizeRequest {
  sql_query: string;
  include_schema?: boolean;
}

export interface SQLOptimizeResponse {
  original_query: string;
  optimized_query: string;
  explanation?: string;
}

export interface SQLExplainRequest {
  sql_query: string;
}

export interface SQLExplainResponse {
  sql_query: string;
  explanation: string;
}
