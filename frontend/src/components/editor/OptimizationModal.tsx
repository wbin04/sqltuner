/**
 * OptimizationModal Component
 * Unified Inline Diff View - Developer-focused SQL optimization display
 */
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'sql-formatter';
import * as Diff from 'diff';
import {
  OptimizationAnalysis,
  REWRITE_TYPE_COLORS,
  REWRITE_TYPE_LABELS,
  RewriteType,
} from '../../types/optimization';

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

  // Only compare pure SQL (no index concatenation)
  const optimizedSql = analysis.optimized_sql;

  // Check if there are actual differences
  const hasDifferences = originalSql.trim() !== optimizedSql.trim();

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

  // Apply fix handler — only replace SQL in editor, index is separate
  const handleApplyFix = () => {
    if (onReplaceQuery) {
      onReplaceQuery(optimizedSql);
      if (analysis.index_recommendation) {
        onNotify?.('Optimization applied! Index suggestion copied — run it separately.', 'success');
      } else {
        onNotify?.('Optimization applied successfully!', 'success');
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={cn(
        'relative w-full max-w-[90vw] max-h-[85vh] rounded-xl shadow-2xl overflow-hidden',
        'bg-white dark:bg-surface-dark',
        'border border-gray-200 dark:border-border-dark',
        'flex flex-col'
      )}>
        {/* Minimalist Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-border-dark bg-surface-highlight-DEFAULT/30 dark:bg-surface-highlight-dark/30 shrink-0">
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

        <div className="px-6 py-4 border-b border-gray-200 dark:border-border-dark bg-surface-highlight-DEFAULT/20 dark:bg-surface-highlight-dark/20 shrink-0 overflow-y-auto max-h-[30vh]">
          {analysis.explanation && (
            <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark mb-3">
              {analysis.explanation}
            </p>
          )}

          {analysis.rewrite_type && analysis.rewrite_type !== 'none' && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Optimization type:
              </span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-semibold',
                  REWRITE_TYPE_COLORS[analysis.rewrite_type as RewriteType] ?? 'bg-gray-100 text-gray-600'
                )}
              >
                {REWRITE_TYPE_LABELS[analysis.rewrite_type as RewriteType] ?? analysis.rewrite_type}
              </span>
            </div>
          )}

          {analysis.changes_made && analysis.changes_made.length > 0 && (
            <div className="mb-4 last:mb-0">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Changes applied:
              </p>
              <ul className="list-disc list-inside space-y-1">
                {analysis.changes_made.map((change, idx) => (
                  <li key={idx} className="text-sm text-gray-600 dark:text-gray-400">
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.bottlenecks && analysis.bottlenecks.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Issues detected:
              </p>
              <ul className="space-y-1 max-h-28 overflow-auto pr-1">
                {analysis.bottlenecks.map((bottleneck, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400"
                  >
                    <span className="mt-0.5">⚠</span>
                    <span>{bottleneck}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.index_recommendation && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                📌 Suggested Index (run separately):
              </p>
              <div className="relative group">
                <pre className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap">
                  {analysis.index_recommendation}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(analysis.index_recommendation!);
                    onNotify?.('Index SQL copied to clipboard!', 'success');
                  }}
                  className="absolute top-2 right-2 px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>

        {/* DiffEditor - Core Component */}
        <div className="flex-1 overflow-y-auto min-h-[300px] bg-surface-light dark:bg-surface-dark">
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
          ) : !originalSql || !optimizedSql ? (
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
            <div className="h-full">
              <div className="font-mono text-sm">
                {/* Unified Diff View with SQL Formatting & Context */}
                {(() => {
                  let formattedOriginal = originalSql;
                  let formattedModified = optimizedSql;
                  try {
                    formattedOriginal = format(originalSql, { language: 'postgresql' });
                    formattedModified = format(optimizedSql, { language: 'postgresql' });
                  } catch (e) {
                    console.warn('SQL formatting failed', e);
                  }

                  const diffResult = Diff.diffLines(formattedOriginal, formattedModified);

                  type LineData = { type: 'removed' | 'added' | 'unchanged' | 'ellipsis'; content: string; origLineNum?: number; modLineNum?: number };
                  const allLines: LineData[] = [];
                  let origLineNum = 1;
                  let modLineNum = 1;

                  diffResult.forEach(part => {
                    const lines = part.value.split('\n');
                    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

                    lines.forEach(line => {
                      if (part.added) {
                        allLines.push({ type: 'added', content: line, modLineNum: modLineNum++ });
                      } else if (part.removed) {
                        allLines.push({ type: 'removed', content: line, origLineNum: origLineNum++ });
                      } else {
                        allLines.push({ type: 'unchanged', content: line, origLineNum: origLineNum++, modLineNum: modLineNum++ });
                      }
                    });
                  });

                  // Show all lines without hiding unchanged ones

                  // Helper to render a single line
                  const renderDiffLine = (line: LineData, idx: number) => {
                    return (
                      <div
                        key={idx}
                        className={cn(
                          'flex items-start px-2 py-0.5 leading-relaxed hover:bg-black/5 dark:hover:bg-white/5',
                          line.type === 'removed' && 'bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200',
                          line.type === 'added' && 'bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-200',
                          line.type === 'unchanged' && 'text-text-main-DEFAULT dark:text-text-main-dark'
                        )}
                      >
                        {/* Old Line Number */}
                        <span className={cn(
                          'inline-block w-8 flex-shrink-0 text-right select-none opacity-50 text-xs font-mono mt-1',
                          line.type === 'removed' && 'text-red-700 dark:text-red-400 font-medium',
                          line.type === 'added' && 'text-transparent select-none' // hide old line num if added
                        )}>
                          {line.origLineNum || ' '}
                        </span>
                        
                        {/* New Line Number */}
                        <span className={cn(
                          'inline-block w-8 flex-shrink-0 text-right select-none opacity-50 text-xs font-mono border-r border-gray-300 dark:border-gray-700 mr-3 pr-2 ml-2 mt-1',
                          line.type === 'added' && 'text-green-700 dark:text-green-400 font-medium',
                          line.type === 'removed' && 'text-transparent select-none' // hide new line num if removed
                        )}>
                          {line.modLineNum || ' '}
                        </span>

                        {/* Diff marker */}
                        <span className={cn(
                          "inline-block w-4 flex-shrink-0 font-bold text-center mt-0.5",
                          line.type === 'removed' ? 'text-red-600 dark:text-red-400' : line.type === 'added' ? 'text-green-600 dark:text-green-400' : 'text-transparent select-none'
                        )}>
                          {line.type === 'removed' ? '−' : line.type === 'added' ? '+' : ' '}
                        </span>

                        {/* Code content */}
                        <span className="flex-1 whitespace-pre-wrap break-all font-mono text-sm leading-6">
                          {line.content || ' '}
                        </span>
                      </div>
                    );
                  };

                  return allLines.map((line, idx) => renderDiffLine(line, idx));
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Compact Footer */}
        <div className="border-t border-gray-200 dark:border-border-dark bg-surface-highlight-DEFAULT/30 dark:bg-surface-highlight-dark/30 px-6 py-4 shrink-0">
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
