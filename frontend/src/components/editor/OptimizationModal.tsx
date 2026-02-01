/**
 * OptimizationModal Component
 * Unified Inline Diff View - Developer-focused SQL optimization display
 */
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { OptimizationAnalysis } from '../../types/optimization';

interface OptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: OptimizationAnalysis | null;
  isAnalyzing: boolean;
  isApplying: boolean;
  originalSql: string;
  onReplaceQuery?: (sql: string) => void;
  onNotify?: (message: string, type: 'success' | 'error') => void;
}

export function OptimizationModal({
  isOpen,
  onClose,
  analysis,
  isAnalyzing,
  isApplying,
  originalSql,
  onReplaceQuery,
  onNotify,
}: OptimizationModalProps) {

  if (!isOpen) return null;

  // Loading state
  if (isAnalyzing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className={cn(
          'relative w-full max-w-5xl rounded-xl shadow-2xl p-8',
          'bg-white dark:bg-surface-dark',
          'border border-gray-200 dark:border-border-dark'
        )}>
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-primary dark:border-primary-dark border-t-transparent rounded-full animate-spin" />
            <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark mt-4">
              AI is analyzing your query...
            </h3>
            <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark mt-2">
              Examining execution plan and identifying bottlenecks
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  // Construct modified code with index recommendation
  const modifiedCode = analysis.index_recommendation
    ? `-- AI Suggested Index\n${analysis.index_recommendation.trim().replace(/;+$/, '')};\n\n${analysis.optimized_sql}`
    : analysis.optimized_sql;

  // Check if there are actual differences
  const hasDifferences = originalSql.trim() !== modifiedCode.trim();

  // Calculate improvement stats
  const stats = analysis.stats_comparison;
  const improvement = stats
    ? `📉 Cost: ${stats.old_cost.toFixed(2)} → ${stats.new_cost.toFixed(2)} (${stats.improvement_percent > 0 ? '-' : '+'}${Math.abs(stats.improvement_percent)}%)`
    : '';

  // Determine badge color based on improvement
  // Positive improvement_percent = better (green), Negative = worse (red)
  const improvementColor = stats
    ? stats.improvement_percent > 0
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-300 dark:border-green-700'
      : stats.improvement_percent < 0
        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-300 dark:border-red-700'
        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-600';

  // Apply fix handler
  const handleApplyFix = () => {
    if (onReplaceQuery) {
      onReplaceQuery(modifiedCode);
      onNotify?.('Optimization applied successfully!', 'success');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={cn(
        'relative w-full max-w-5xl max-h-[85vh] rounded-xl shadow-2xl overflow-hidden',
        'bg-white dark:bg-surface-dark',
        'border border-gray-200 dark:border-border-dark',
        'flex flex-col'
      )}>
        {/* Minimalist Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-border-dark bg-surface-highlight-DEFAULT/30 dark:bg-surface-highlight-dark/30">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-text-main-DEFAULT dark:text-text-main-dark">
              Optimization Analysis
            </h2>
            {stats && (
              <span className={cn(
                'px-3 py-1 rounded-full text-xs font-semibold',
                improvementColor
              )}>
                {improvement}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark transition-colors"
          >
            <X className="w-5 h-5 text-text-muted-DEFAULT dark:text-text-muted-dark" />
          </button>
        </div>

        {/* DiffEditor - Core Component */}
        <div className="flex-1 overflow-hidden" style={{ minHeight: '400px' }}>
          {!hasDifferences ? (
            <div className="flex items-center justify-center h-full p-8">
              <div className="text-center max-w-md">
                <div className="text-4xl mb-4">✨</div>
                <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-2">
                  No Changes Needed
                </h3>
                <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                  The optimized query is identical to the original. Your query is already well-optimized!
                </p>
              </div>
            </div>
          ) : !originalSql || !modifiedCode ? (
            <div className="flex items-center justify-center h-full p-8">
              <div className="text-center max-w-md">
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-2">
                  Missing Data
                </h3>
                <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                  Unable to display diff: SQL data is missing.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto bg-surface-DEFAULT dark:bg-surface-dark">
              <div className="font-mono text-sm">
                {/* Intelligent Inline Diff View */}
                {(() => {
                  const originalLines = originalSql.split('\n');
                  const modifiedLines = modifiedCode.split('\n');

                  // Build a simple line-by-line diff
                  const diffLines: Array<{ type: 'removed' | 'added' | 'unchanged'; content: string; lineNum?: number }> = [];

                  // Find common prefix (unchanged lines at the start)
                  let commonPrefixLength = 0;
                  while (
                    commonPrefixLength < originalLines.length &&
                    commonPrefixLength < modifiedLines.length &&
                    originalLines[commonPrefixLength] === modifiedLines[commonPrefixLength]
                  ) {
                    commonPrefixLength++;
                  }

                  // Find common suffix (unchanged lines at the end)
                  let commonSuffixLength = 0;
                  while (
                    commonSuffixLength < (originalLines.length - commonPrefixLength) &&
                    commonSuffixLength < (modifiedLines.length - commonPrefixLength) &&
                    originalLines[originalLines.length - 1 - commonSuffixLength] === 
                    modifiedLines[modifiedLines.length - 1 - commonSuffixLength]
                  ) {
                    commonSuffixLength++;
                  }

                  // Add unchanged prefix
                  for (let i = 0; i < commonPrefixLength; i++) {
                    diffLines.push({ 
                      type: 'unchanged', 
                      content: originalLines[i], 
                      lineNum: i + 1 
                    });
                  }

                  // Add removed lines (from original, not in common parts)
                  for (let i = commonPrefixLength; i < originalLines.length - commonSuffixLength; i++) {
                    diffLines.push({ 
                      type: 'removed', 
                      content: originalLines[i], 
                      lineNum: i + 1 
                    });
                  }

                  // Add added lines (from modified, not in common parts)
                  for (let i = commonPrefixLength; i < modifiedLines.length - commonSuffixLength; i++) {
                    diffLines.push({ 
                      type: 'added', 
                      content: modifiedLines[i], 
                      lineNum: i + 1 
                    });
                  }

                  // Add unchanged suffix
                  const suffixStartOrig = originalLines.length - commonSuffixLength;
                  for (let i = 0; i < commonSuffixLength; i++) {
                    diffLines.push({ 
                      type: 'unchanged', 
                      content: originalLines[suffixStartOrig + i], 
                      lineNum: suffixStartOrig + i + 1 
                    });
                  }

                  return diffLines.map((line, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-start px-4 py-1 leading-relaxed',
                        line.type === 'removed' && 'bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200',
                        line.type === 'added' && 'bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-200',
                        line.type === 'unchanged' && 'text-text-main-DEFAULT dark:text-text-main-dark'
                      )}
                    >
                      {/* Line number */}
                      <span className={cn(
                        'inline-block w-12 flex-shrink-0 text-right mr-4 select-none opacity-50 text-xs',
                        line.type === 'removed' && 'text-red-700 dark:text-red-400',
                        line.type === 'added' && 'text-green-700 dark:text-green-400',
                        line.type === 'unchanged' && 'text-text-muted-DEFAULT dark:text-text-muted-dark'
                      )}>
                        {line.type !== 'unchanged' ? line.lineNum || '' : ''}
                      </span>

                      {/* Diff marker */}
                      <span className="inline-block w-4 flex-shrink-0 mr-2 font-bold">
                        {line.type === 'removed' ? '−' : line.type === 'added' ? '+' : ' '}
                      </span>

                      {/* Code content */}
                      <span className="flex-1 whitespace-pre-wrap break-all">
                        {line.content || ' '}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Compact Footer */}
        <div className="border-t border-gray-200 dark:border-border-dark bg-surface-highlight-DEFAULT/30 dark:bg-surface-highlight-dark/30 px-6 py-4">
          {/* Optional AI Reasoning */}
          {analysis.explanation && (
            <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark italic mb-4 line-clamp-2">
              💡 {analysis.explanation}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className={cn(
                'px-5 py-2 rounded-lg font-medium transition-colors',
                'border border-border-DEFAULT dark:border-border-dark',
                'text-text-main-DEFAULT dark:text-text-main-dark',
                'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark'
              )}
            >
              Dismiss
            </button>
            <button
              onClick={handleApplyFix}
              disabled={isApplying}
              className={cn(
                'px-5 py-2 rounded-lg font-semibold transition-all',
                'bg-gradient-to-r from-primary to-secondary',
                'dark:from-primary-dark dark:to-secondary-dark',
                'text-white shadow-md hover:shadow-lg',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center gap-2'
              )}
            >
              {isApplying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Applying...
                </>
              ) : (
                <>Apply Fix</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
