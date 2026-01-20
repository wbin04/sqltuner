/**
 * useOptimization Hook
 * Manages SQL optimization analysis lifecycle
 */
import { useState, useCallback } from 'react';
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
}

export function useOptimization({
  connectionId,
  originalSql,
  onSuccess,
  onError,
}: UseOptimizationProps): UseOptimizationReturn {
  const [analysis, setAnalysis] = useState<OptimizationAnalysis | null>(null);
  const [error, setError] = useState<Error | null>(null);

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
        bottlenecks: extractBottlenecks(data.explanation),
        optimized_sql: data.optimized_sql,
        index_recommendation: data.index_recommendation,
        explanation: data.explanation,
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

    await optimizeMutation.mutateAsync();
  }, [originalSql, optimizeMutation, onError]);

  // Apply the index recommendation
  const applyFix = useCallback(async () => {
    if (!analysis?.index_recommendation) {
      onError?.('No index recommendation to apply');
      return;
    }

    await applyIndexMutation.mutateAsync();
  }, [analysis, applyIndexMutation, onError]);

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
  };
}

/**
 * Extract bottlenecks from explanation text
 * Looks for common performance issue patterns
 */
function extractBottlenecks(explanation: string): string[] {
  const bottlenecks: string[] = [];
  const lowerExplanation = explanation.toLowerCase();

  // Common bottleneck patterns
  const patterns = [
    { regex: /sequential scan|seq scan|full table scan/i, label: 'Sequential Scan' },
    { regex: /missing index|no index|without index/i, label: 'Missing Index' },
    { regex: /high cost|expensive|slow/i, label: 'High Query Cost' },
    { regex: /nested loop/i, label: 'Nested Loop Join' },
    { regex: /hash join/i, label: 'Hash Join' },
    { regex: /sort|sorting/i, label: 'Expensive Sort Operation' },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(lowerExplanation)) {
      bottlenecks.push(pattern.label);
    }
  }

  // Extract specific bottlenecks from "Detected Performance Bottlenecks:" section
  const bottleneckSection = explanation.match(/Detected Performance Bottlenecks:([\s\S]*?)(?:\n\n|$)/);
  if (bottleneckSection && bottleneckSection[1]) {
    const items = bottleneckSection[1]
      .split('\n')
      .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
      .filter(line => line.length > 0);
    
    bottlenecks.push(...items);
  }

  // Remove duplicates and return
  return Array.from(new Set(bottlenecks));
}
