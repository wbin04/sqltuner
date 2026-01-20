/**
 * OptimizationModal Component
 * Shows SQL optimization results with 3-step workflow:
 * 1. Diagnosis (Bottlenecks)
 * 2. Solution (Diff View)
 * 3. Action (Apply Fix)
 */
import { useState } from 'react';
import { 
  X, 
  TrendingDown, 
  Zap, 
  CheckCircle, 
  AlertTriangle, 
  Copy, 
  RefreshCw,
  Database,
  Code,
  Sparkles,
  Clock
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { OptimizationAnalysis } from '../../types/optimization';

interface OptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: OptimizationAnalysis | null;
  isAnalyzing: boolean;
  isApplying: boolean;
  onApplyIndex?: () => void;
  onReplaceQuery?: (sql: string) => void;
  onNotify?: (message: string, type: 'success' | 'error') => void;
}

export function OptimizationModal({
  isOpen,
  onClose,
  analysis,
  isAnalyzing,
  isApplying,
  onApplyIndex,
  onReplaceQuery,
  onNotify,
}: OptimizationModalProps) {
  const [selectedTab, setSelectedTab] = useState<'diff' | 'original' | 'optimized'>('diff');

  if (!isOpen) return null;

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    onNotify?.(`${label} copied to clipboard!`, 'success');
  };

  // Loading skeleton
  if (isAnalyzing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className={cn(
          'relative w-full max-w-6xl rounded-2xl shadow-2xl p-8',
          'bg-white dark:bg-surface-dark',
          'border border-gray-200 dark:border-border-dark'
        )}>
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <RefreshCw className="w-16 h-16 text-primary dark:text-primary-dark animate-spin" />
              <Sparkles className="w-8 h-8 text-yellow-500 absolute -top-2 -right-2 animate-pulse" />
            </div>
            <h3 className="text-xl font-semibold text-text-main-DEFAULT dark:text-text-main-dark mt-6">
              AI is analyzing your query...
            </h3>
            <p className="text-text-muted-DEFAULT dark:text-text-muted-dark mt-2">
              Examining execution plan and identifying bottlenecks
            </p>
            <div className="mt-8 space-y-3 w-full max-w-md">
              {['Analyzing query structure', 'Checking indexes', 'Generating recommendations'].map((step, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    idx === 0 ? 'bg-primary dark:bg-primary-dark animate-pulse' : 'bg-gray-300 dark:bg-gray-600'
                  )} />
                  <span className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) return null;


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
                Query Optimization Analysis
              </h2>
              <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                AI-powered performance improvement recommendations
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
          
          {/* SECTION A: DIAGNOSIS - Performance Stats & Bottlenecks */}
          <div className="p-6 border-b border-gray-200 dark:border-border-dark bg-surface-highlight-DEFAULT/30 dark:bg-surface-highlight-dark/30">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark">
                Step 1: Diagnosis
              </h3>
            </div>

            {/* Performance Metrics */}
            {analysis.stats_comparison && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className={cn(
                  'p-4 rounded-xl',
                  'bg-blue-50 dark:bg-blue-900/20',
                  'border border-blue-200 dark:border-blue-800'
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-medium text-blue-900 dark:text-blue-300">
                      Original Cost
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {analysis.stats_comparison.old_cost.toFixed(2)}
                  </p>
                </div>
                
                <div className={cn(
                  'p-4 rounded-xl',
                  'bg-green-50 dark:bg-green-900/20',
                  'border border-green-200 dark:border-green-800'
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-xs font-medium text-green-900 dark:text-green-300">
                      Optimized Cost
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {analysis.stats_comparison.new_cost.toFixed(2)}
                  </p>
                </div>
                
                <div className={cn(
                  'p-4 rounded-xl',
                  'bg-purple-50 dark:bg-purple-900/20',
                  'border border-purple-200 dark:border-purple-800'
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-xs font-medium text-purple-900 dark:text-purple-300">
                      Improvement
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {analysis.stats_comparison.improvement_percent}%
                  </p>
                </div>
              </div>
            )}

            {/* Bottlenecks */}
            {analysis.bottlenecks && analysis.bottlenecks.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-3">
                  Detected Performance Bottlenecks
                </h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.bottlenecks.map((bottleneck, idx) => (
                    <span
                      key={idx}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
                        'bg-red-100 dark:bg-red-900/30',
                        'text-red-800 dark:text-red-200',
                        'border border-red-300 dark:border-red-700'
                      )}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {bottleneck}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Explanation */}
            <div className="mt-6 p-4 rounded-lg bg-white dark:bg-surface-dark border border-gray-200 dark:border-border-dark">
              <h4 className="text-sm font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                AI Analysis
              </h4>
              <p className="text-sm text-text-main-DEFAULT dark:text-text-main-dark leading-relaxed whitespace-pre-wrap">
                {analysis.explanation}
              </p>
            </div>
          </div>

          {/* SECTION B: THE SOLUTION - Diff View */}
          <div className="p-6 border-b border-gray-200 dark:border-border-dark">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-primary dark:text-primary-dark" />
                <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark">
                  Step 2: The Solution
                </h3>
              </div>
              
              {/* Tab Switcher */}
              <div className="flex gap-1 p-1 bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark rounded-lg">
                <button
                  onClick={() => setSelectedTab('diff')}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    selectedTab === 'diff'
                      ? 'bg-white dark:bg-surface-dark text-primary dark:text-primary-dark shadow-sm'
                      : 'text-text-muted-DEFAULT dark:text-text-muted-dark hover:text-text-main-DEFAULT dark:hover:text-text-main-dark'
                  )}
                >
                  Side-by-Side
                </button>
                <button
                  onClick={() => setSelectedTab('original')}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    selectedTab === 'original'
                      ? 'bg-white dark:bg-surface-dark text-primary dark:text-primary-dark shadow-sm'
                      : 'text-text-muted-DEFAULT dark:text-text-muted-dark hover:text-text-main-DEFAULT dark:hover:text-text-main-dark'
                  )}
                >
                  Original
                </button>
                <button
                  onClick={() => setSelectedTab('optimized')}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    selectedTab === 'optimized'
                      ? 'bg-white dark:bg-surface-dark text-primary dark:text-primary-dark shadow-sm'
                      : 'text-text-muted-DEFAULT dark:text-text-muted-dark hover:text-text-main-DEFAULT dark:hover:text-text-main-dark'
                  )}
                >
                  Optimized
                </button>
              </div>
            </div>

            {/* SQL Display */}
            {selectedTab === 'diff' && (
              <div className="grid grid-cols-2 gap-4">
                {/* Original SQL */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      Original Query
                    </span>
                    <button
                      onClick={() => copyToClipboard(analysis.optimized_sql, 'Original SQL')}
                      className="p-1.5 rounded hover:bg-surface-highlight-DEFAULT dark:hover:bg-surface-highlight-dark"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className={cn(
                    'rounded-lg overflow-hidden',
                    'bg-red-50 dark:bg-red-900/10',
                    'border border-red-200 dark:border-red-800'
                  )}>
                    <pre className="p-4 overflow-x-auto text-xs leading-relaxed max-h-96">
                      <code className="font-mono text-red-900 dark:text-red-200">
                        {analysis.optimized_sql}
                      </code>
                    </pre>
                  </div>
                </div>

                {/* Optimized SQL */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Optimized Query
                    </span>
                    <button
                      onClick={() => copyToClipboard(analysis.optimized_sql, 'Optimized SQL')}
                      className="p-1.5 rounded hover:bg-surface-highlight-DEFAULT dark:hover:bg-surface-highlight-dark"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className={cn(
                    'rounded-lg overflow-hidden',
                    'bg-green-50 dark:bg-green-900/10',
                    'border border-green-200 dark:border-green-800'
                  )}>
                    <pre className="p-4 overflow-x-auto text-xs leading-relaxed max-h-96">
                      <code className="font-mono text-green-900 dark:text-green-200">
                        {analysis.optimized_sql}
                      </code>
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {selectedTab === 'original' && (
              <div className={cn(
                'rounded-lg overflow-hidden',
                'bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark',
                'border border-border-DEFAULT dark:border-border-dark'
              )}>
                <pre className="p-4 overflow-x-auto text-sm leading-relaxed max-h-96">
                  <code className="font-mono text-text-main-DEFAULT dark:text-text-main-dark">
                    {analysis.optimized_sql}
                  </code>
                </pre>
              </div>
            )}

            {selectedTab === 'optimized' && (
              <div className={cn(
                'rounded-lg overflow-hidden',
                'bg-green-50 dark:bg-green-900/10',
                'border border-green-200 dark:border-green-800'
              )}>
                <pre className="p-4 overflow-x-auto text-sm leading-relaxed max-h-96">
                  <code className="font-mono text-green-900 dark:text-green-200">
                    {analysis.optimized_sql}
                  </code>
                </pre>
              </div>
            )}
          </div>

          {/* SECTION C: ACTION - Apply Fix */}
          {analysis.index_recommendation && (
            <div className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10">
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark">
                  Step 3: Action Required
                </h3>
              </div>

              <div className={cn(
                'p-4 rounded-lg mb-4',
                'bg-white dark:bg-surface-dark',
                'border-2 border-orange-300 dark:border-orange-700'
              )}>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-semibold text-orange-900 dark:text-orange-200">
                    Recommended Index
                  </span>
                  <button
                    onClick={() => copyToClipboard(analysis.index_recommendation!, 'Index DDL')}
                    className="p-1.5 rounded hover:bg-surface-highlight-DEFAULT dark:hover:bg-surface-highlight-dark"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <pre className="p-3 rounded bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark overflow-x-auto text-xs">
                  <code className="font-mono text-text-main-DEFAULT dark:text-text-main-dark">
                    {analysis.index_recommendation}
                  </code>
                </pre>
              </div>

              <div className={cn(
                'flex items-start gap-3 p-3 rounded-lg mb-4',
                'bg-yellow-100 dark:bg-yellow-900/20',
                'border border-yellow-300 dark:border-yellow-700'
              )}>
                <AlertTriangle className="w-5 h-5 text-yellow-700 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-900 dark:text-yellow-200">
                  <p className="font-medium mb-1">⚠️ Important Notice</p>
                  <p className="text-xs leading-relaxed">
                    Creating indexes on large tables may take time and temporarily lock the table. 
                    It's recommended to apply this during off-peak hours or test in a development environment first.
                  </p>
                </div>
              </div>

              {onApplyIndex && (
                <button
                  onClick={onApplyIndex}
                  disabled={isApplying}
                  className={cn(
                    'w-full px-6 py-3 rounded-lg font-semibold transition-all',
                    'bg-gradient-to-r from-orange-500 to-orange-600',
                    'hover:from-orange-600 hover:to-orange-700',
                    'text-white shadow-lg hover:shadow-xl',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'flex items-center justify-center gap-2'
                  )}
                >
                  {isApplying ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Applying Index...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      ⚡ Apply Index Now
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 dark:border-border-dark bg-surface-highlight-DEFAULT/50 dark:bg-surface-highlight-dark/50">
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
          
          {onReplaceQuery && (
            <button
              onClick={() => {
                onReplaceQuery(analysis.optimized_sql);
                onClose();
              }}
              className={cn(
                'px-6 py-2.5 rounded-lg font-semibold transition-all',
                'bg-gradient-to-r from-primary to-secondary',
                'dark:from-primary-dark dark:to-secondary-dark',
                'text-white shadow-lg hover:shadow-xl',
                'flex items-center gap-2'
              )}
            >
              <CheckCircle className="w-5 h-5" />
              Replace Query with Optimized Version
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
