import api from '../lib/axios';

export interface EvalOverall {
  'EM (%)': number;
  'EX (%)': number;
  'SL (%)'?: number;
  'SL (Soft Label %)'?: number;
  'SL_Linkage (%)'?: number;
  avg_latency_s: number;
}

export interface HardnessGroup {
  count: number;
  em: number;
  ex: number;
  sl: number;
}

export interface DetailedResult {
  db_id: string;
  question: string;
  gold_sql: string;
  pred_sql: string | null;
  em: number;
  ex: number;
  sl: number;
  hardness: string;
  complexity_score: number;
  latency_s: number;
  error: string | null;
}

export interface FailedCase {
  db_id: string;
  question: string;
  gold_sql: string;
  pred_sql: string | null;
  sl: number;
  error: string | null;
}

export interface EvalResults {
  timestamp: string;
  config: Record<string, any>;
  total_evaluated: number;
  total_errors: number;
  interrupted?: boolean;
  overall: EvalOverall;
  by_hardness: Record<string, HardnessGroup>;
  detailed_results: DetailedResult[];
  errors: any[];
  failed_cases: FailedCase[];
}

export const evaluationService = {
  async getResults(): Promise<EvalResults> {
    const resp = await api.get<EvalResults>('/evaluation/results');
    return resp.data;
  },
};
