/**
 * Admin Evaluation Service
 * API client for per-database Spider evaluation from Admin UI.
 */
import api from '../lib/axios';

const BASE = '/admin-eval';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SpiderDBInfo {
  db_id: string;
  question_count: number;
  has_sqlite: boolean;
  schema_loaded?: boolean;
}

export interface UserAccountInfo {
  id: string;
  email: string;
  role: string;
}

export interface LoadSchemaResponse {
  status: string;
  db_id: string;
  connection_id: string;
  tables_loaded: number;
  meta_schema: any;
}

export interface EvalOverall {
  'EM (%)': number;
  'EX (%)': number;
  'SL (Soft Label %)'?: number;
  'SL_Linkage (%)'?: number;
  avg_latency_s: number;
}

export interface DetailedResult {
  db_id: string;
  question: string;
  gold_sql: string;
  pred_sql: string | null;
  em: number;
  ex: number;
  sl: number;
  sl_linkage?: number;
  hardness: string;
  complexity_score: number;
  latency_s: number;
  error: string | null;
  llm_raw?: string;
}

export interface FailedCase {
  db_id: string;
  question: string;
  gold_sql: string;
  pred_sql: string | null;
  sl: number;
  error: string | null;
}

export interface EvalReport {
  timestamp: string;
  config: Record<string, any>;
  total_evaluated: number;
  total_errors: number;
  overall: EvalOverall;
  by_hardness: Record<string, { count: number; em: number; ex: number; sl: number }>;
  detailed_results: DetailedResult[];
  errors: any[];
  failed_cases: FailedCase[];
}

export interface EvalStatusMap {
  [db_id: string]: {
    has_results: boolean;
    total_evaluated?: number;
    timestamp?: string;
    overall?: EvalOverall;
  };
}

// ── Service ──────────────────────────────────────────────────────────────────

export const adminEvalService = {
  async listSpiderDatabases(): Promise<SpiderDBInfo[]> {
    const r = await api.get<SpiderDBInfo[]>(`${BASE}/spider-databases`);
    return r.data;
  },

  async listUsersForEval(): Promise<UserAccountInfo[]> {
    const r = await api.get<UserAccountInfo[]>(`${BASE}/users-for-eval`);
    return r.data;
  },

  async ensureEvalUser(): Promise<UserAccountInfo> {
    const r = await api.post<UserAccountInfo>(`${BASE}/ensure-eval-user`);
    return r.data;
  },

  async loadSchema(db_id: string, user_id: string): Promise<LoadSchemaResponse> {
    const r = await api.post<LoadSchemaResponse>(`${BASE}/load-schema`, { db_id, user_id });
    return r.data;
  },

  async runEvaluation(dbId: string, userId: string, limit?: number): Promise<any> {
    const r = await api.post(`${BASE}/run-evaluation`, { db_id: dbId, user_id: userId, limit }, { timeout: 0 });
    return r.data;
  },

  async getProgress(dbId: string): Promise<{current: number; total: number}> {
    const r = await api.get<{current: number; total: number}>(`${BASE}/progress/${dbId}`);
    return r.data;
  },

  async getResults(db_id: string): Promise<EvalReport> {
    const r = await api.get<EvalReport>(`${BASE}/results/${db_id}`);
    return r.data;
  },

  async getAllStatus(): Promise<EvalStatusMap> {
    const r = await api.get<EvalStatusMap>(`${BASE}/results-status`);
    return r.data;
  },
};
