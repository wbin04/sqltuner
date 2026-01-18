/**
 * OptimizationModal Component
 * Shows SQL optimization results with diff view and performance stats
 */
import { X, TrendingDown, Zap, CheckCircle, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface OptimizationResult {
  original_sql: string;
  optimized_sql: string;
  cost_reduction: number;
  execution_time_improvement: number;
  index_recommendations?: string[];
  explanation: string;
}

interface OptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: OptimizationResult | null;
  onApply?: (sql: string) => void;
}

export function OptimizationModal({
  isOpen,
  onClose,
  result,
  onApply,
}: OptimizationModalProps) {
  if (!isOpen || !result) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/50 backdrop-blur-sm">
      <div className={cn(
        'relative w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden',
        'bg-white dark:bg-surface-dark',
        'border border-gray-200 dark:border-border-dark'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-border-dark bg-gradient-to-r from-primary/5 to-secondary/5 dark:from-primary-dark/5 dark:to-secondary-dark/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary dark:from-primary-dark dark:to-secondary-dark flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
                Query Optimization
              </h2>
              <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                AI-powered performance improvement
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-12rem)]">
          {/* Performance Stats */}
          <div className="p-6 grid grid-cols-2 gap-4 bg-surface-highlight-DEFAULT/50 dark:bg-surface-highlight-dark/50">
            <div className={cn(
              'p-4 rounded-xl',
              'bg-green-50 dark:bg-green-900/20',
              'border border-green-200 dark:border-green-800'
            )}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-900 dark:text-green-300">
                  Cost Reduction
                </span>
              </div>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {result.cost_reduction}%
              </p>
            </div>
            <div className={cn(
              'p-4 rounded-xl',
              'bg-blue-50 dark:bg-blue-900/20',
              'border border-blue-200 dark:border-blue-800'
            )}>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                  Speed Improvement
                </span>
              </div>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {result.execution_time_improvement}x
              </p>
            </div>
          </div>

          {/* Explanation */}
          <div className="p-6 border-b border-gray-200 dark:border-border-dark">
            <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-3">
              What Changed
            </h3>
            <p className="text-text-main-DEFAULT dark:text-text-main-dark leading-relaxed">
              {result.explanation}
            </p>
          </div>

          {/* SQL Diff View */}
          <div className="p-6 border-b border-gray-200 dark:border-border-dark">
            <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-4">
              SQL Comparison
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Original SQL */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-text-muted-DEFAULT dark:text-text-muted-dark">
                    Original Query
                  </span>
                </div>
                <div className={cn(
                  'rounded-lg overflow-hidden',
                  'bg-red-50 dark:bg-red-900/10',
                  'border border-red-200 dark:border-red-800'
                )}>
                  <pre className="p-4 overflow-x-auto text-sm">
                    <code className="font-mono text-red-900 dark:text-red-200">
                      {result.original_sql}
                    </code>
                  </pre>
                </div>
              </div>

              {/* Optimized SQL */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    Optimized Query
                  </span>
                </div>
                <div className={cn(
                  'rounded-lg overflow-hidden',
                  'bg-green-50 dark:bg-green-900/10',
                  'border border-green-200 dark:border-green-800'
                )}>
                  <pre className="p-4 overflow-x-auto text-sm">
                    <code className="font-mono text-green-900 dark:text-green-200">
                      {result.optimized_sql}
                    </code>
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Index Recommendations */}
          {result.index_recommendations && result.index_recommendations.length > 0 && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-3">
                Index Recommendations
              </h3>
              <div className="space-y-2">
                {result.index_recommendations.map((recommendation, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg',
                      'bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark',
                      'border border-border-DEFAULT dark:border-border-dark'
                    )}
                  >
                    <CheckCircle className="w-5 h-5 text-primary dark:text-primary-dark flex-shrink-0 mt-0.5" />
                    <pre className="text-sm font-mono text-text-main-DEFAULT dark:text-text-main-dark overflow-x-auto">
                      {recommendation}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-border-dark bg-surface-highlight-DEFAULT/50 dark:bg-surface-highlight-dark/50">
          <button
            onClick={onClose}
            className={cn(
              'px-6 py-2.5 rounded-lg font-medium transition-colors',
              'border border-border-DEFAULT dark:border-border-dark',
              'text-text-main-DEFAULT dark:text-text-main-dark',
              'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark'
            )}
          >
            Close
          </button>
          {onApply && (
            <button
              onClick={() => {
                onApply(result.optimized_sql);
                onClose();
              }}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white',
                'bg-gradient-to-r from-primary to-secondary dark:from-primary-dark dark:to-secondary-dark',
                'hover:shadow-lg transition-all'
              )}
            >
              Apply Optimization
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
