/**
 * useOptimization Hook
 * Manages SQL optimization analysis lifecycle
 */
import { useState, useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { sqlService } from '../services/sqlService';
import { OptimizationAnalysis } from '../types/optimization';

interface UseOptimizationProps {
  connectionId: string;
  originalSql: string;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

interface UseOptimizationReturn {
  analysis: OptimizationAnalysis | null;
  isAnalyzing: boolean;
  isApplying: boolean;
  error: Error | null;
  runAnalysis: () => Promise<void>;
  applyFix: () => Promise<void>;
  resetAnalysis: () => void;
  markAsOptimized: (sql: string) => void;
}

export function useOptimization({
  connectionId,
  originalSql,
  onSuccess,
  onError,
}: UseOptimizationProps): UseOptimizationReturn {
  const [analysis, setAnalysis] = useState<OptimizationAnalysis | null>(null);
  const [error, setError] = useState<Error | null>(null);
  // Track the last optimized SQL to prevent redundant optimize calls
  const lastOptimizedSqlRef = useRef<string | null>(null);

  // Optimize SQL mutation
  const optimizeMutation = useMutation({
    mutationFn: async () => {
      return sqlService.optimize({
        connection_id: connectionId,
        sql_query: originalSql,
        include_explain: true,
      });
    },
    onSuccess: (data) => {
      // Transform backend response to frontend analysis format
      const optimizationAnalysis: OptimizationAnalysis = {
        original_cost: data.stats_comparison?.old_cost ?? null,
        bottlenecks: data.bottlenecks ?? [],
        optimized_sql: data.optimized_sql,
        index_recommendation: data.index_recommendation ?? undefined,
        explanation: data.explanation,
        rewrite_type: data.rewrite_type,
        changes_made: data.changes_made ?? [],
        stats_comparison: data.stats_comparison,
      };

      setAnalysis(optimizationAnalysis);
      setError(null);
      
      onSuccess?.('Analysis completed successfully!');
    },
    onError: (err: Error) => {
      setError(err);
      setAnalysis(null);
      
      onError?.(`Analysis failed: ${err.message}`);
    },
  });

  // Apply index recommendation mutation
  const applyIndexMutation = useMutation({
    mutationFn: async () => {
      if (!analysis?.index_recommendation) {
        throw new Error('No index recommendation available');
      }

      return sqlService.execute({
        connection_id: connectionId,
        sql: analysis.index_recommendation,
      });
    },
    onSuccess: () => {
      onSuccess?.('Index applied successfully!');
    },
    onError: (err: Error) => {
      onError?.(`Failed to apply index: ${err.message}`);
    },
  });

  // Run optimization analysis
  const runAnalysis = useCallback(async () => {
    if (!originalSql.trim()) {
      onError?.('Please provide a SQL query to analyze');
      return;
    }

    // Idempotency guard: if this SQL was already optimized, show "no changes needed"
    const normalizedCurrent = originalSql.trim().replace(/\s+/g, ' ').toLowerCase();
    const normalizedLast = lastOptimizedSqlRef.current?.trim().replace(/\s+/g, ' ').toLowerCase();

    if (normalizedLast && normalizedCurrent === normalizedLast) {
      setAnalysis({
        original_cost: null,
        bottlenecks: [],
        optimized_sql: originalSql,
        explanation: 'This query has already been optimized. No further changes needed.',
        rewrite_type: 'none',
        changes_made: [],
        stats_comparison: undefined,
      });
      setError(null);
      onSuccess?.('Query is already optimized!');
      return;
    }

    await optimizeMutation.mutateAsync();
  }, [originalSql, optimizeMutation, onError, onSuccess]);

  // Apply the index recommendation
  const applyFix = useCallback(async () => {
    if (!analysis?.index_recommendation) {
      onError?.('No index recommendation to apply');
      return;
    }

    await applyIndexMutation.mutateAsync();
  }, [analysis, applyIndexMutation, onError]);

  // Mark a SQL string as "already optimized" to prevent re-optimization
  const markAsOptimized = useCallback((sql: string) => {
    lastOptimizedSqlRef.current = sql;
  }, []);

  // Reset analysis state
  const resetAnalysis = useCallback(() => {
    setAnalysis(null);
    setError(null);
  }, []);

  return {
    analysis,
    isAnalyzing: optimizeMutation.isPending,
    isApplying: applyIndexMutation.isPending,
    error,
    runAnalysis,
    applyFix,
    resetAnalysis,
    markAsOptimized,
  };
}
