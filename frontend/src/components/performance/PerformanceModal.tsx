import React from 'react';
import { X, Clock, DollarSign, AlertTriangle, CheckCircle2, Copy, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { PerformanceAnalysis, ExplainPlanNode } from '../../types';

interface PerformanceModalProps {
  analysis: PerformanceAnalysis;
  isOpen: boolean;
  onClose: () => void;
}

export function PerformanceModal({ analysis, isOpen, onClose }: PerformanceModalProps) {
  const [copiedIndex, setCopiedIndex] = React.useState(false);

  if (!isOpen) return null;

  const getExecutionColor = (timeMs: number) => {
    if (timeMs < 100) return 'text-green-400';
    if (timeMs < 1000) return 'text-yellow-400';
    return 'text-red-400';
  };

  const copyIndexSQL = () => {
    if (analysis.index_recommendation) {
      navigator.clipboard.writeText(analysis.index_recommendation);
      setCopiedIndex(true);
      setTimeout(() => setCopiedIndex(false), 2000);
    }
  };

  const renderPlanNode = (node: ExplainPlanNode, depth: number = 0) => {
    const isSeqScan = node['Node Type'].includes('Seq Scan');
    const isIndexScan = node['Node Type'].includes('Index Scan');
    
    return (
      <div key={`${node['Node Type']}-${depth}`} className="space-y-2">
        <div 
          className={cn(
            'rounded-lg p-3 border',
            isSeqScan && 'bg-red-500/10 border-red-500/30',
            isIndexScan && 'bg-green-500/10 border-green-500/30',
            !isSeqScan && !isIndexScan && 'bg-midnight-800 border-midnight-700'
          )}
          style={{ marginLeft: `${depth * 20}px` }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {isSeqScan && <AlertTriangle className="w-4 h-4 text-red-400" />}
                {isIndexScan && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                <span className={cn(
                  'font-medium text-sm',
                  isSeqScan && 'text-red-400',
                  isIndexScan && 'text-green-400',
                  !isSeqScan && !isIndexScan && 'text-text-main'
                )}>
                  {node['Node Type']}
                </span>
                {node['Relation Name'] && (
                  <span className="text-xs text-text-muted">
                    on {node['Relation Name']}
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-text-muted">Cost:</span>{' '}
                  <span className="text-text-main font-mono">
                    {node['Startup Cost'].toFixed(2)} .. {node['Total Cost'].toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">Rows:</span>{' '}
                  <span className="text-text-main font-mono">{node['Plan Rows']}</span>
                </div>
                {node['Actual Rows'] !== undefined && (
                  <div>
                    <span className="text-text-muted">Actual Rows:</span>{' '}
                    <span className="text-text-main font-mono">{node['Actual Rows']}</span>
                  </div>
                )}
                {node['Index Name'] && (
                  <div className="col-span-2">
                    <span className="text-text-muted">Index:</span>{' '}
                    <span className="text-green-400 font-mono">{node['Index Name']}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {node.Plans && node.Plans.length > 0 && (
          <div className="space-y-2">
            {node.Plans.map((childNode, idx) => (
              <div key={idx}>
                {renderPlanNode(childNode, depth + 1)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-midnight-900 rounded-xl border border-midnight-800 w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-midnight-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-main">Performance Analysis</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-midnight-800 text-text-muted hover:text-text-main transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="px-6 py-4 border-b border-midnight-800 bg-midnight-950">
          <div className="grid grid-cols-2 gap-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-midnight-800">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs text-text-muted">Execution Time</p>
                <p className={cn('text-2xl font-bold', getExecutionColor(analysis.execution_time_ms))}>
                  {analysis.execution_time_ms}ms
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-midnight-800">
                <DollarSign className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-text-muted">Total Cost</p>
                <p className="text-2xl font-bold text-text-main">
                  {analysis.total_cost.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Explain Plan */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-text-main mb-2">Query Execution Plan</h3>
            <p className="text-xs text-text-muted mb-4">
              Red nodes indicate sequential scans that may benefit from indexing. 
              Green nodes show efficient index usage.
            </p>
          </div>
          
          <div className="space-y-2">
            {renderPlanNode(analysis.explain_plan)}
          </div>
        </div>

        {/* AI Recommendation */}
        {analysis.index_recommendation && (
          <div className="px-6 py-4 border-t border-midnight-800 bg-midnight-950">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-text-main mb-1">
                  AI Recommendation
                </h3>
                <p className="text-xs text-text-muted">
                  Creating this index may improve query performance
                </p>
              </div>
              <button
                onClick={copyIndexSQL}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm transition-colors"
              >
                {copiedIndex ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy SQL</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="bg-midnight-900 rounded-lg p-4 border border-midnight-800">
              <pre className="text-xs font-mono text-text-main overflow-x-auto">
                <code>{analysis.index_recommendation}</code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
