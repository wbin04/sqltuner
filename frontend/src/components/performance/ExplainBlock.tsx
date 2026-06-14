/**
 * ExplainModal Component
 * Full-screen popup modal for SQL EXPLAIN / EXPLAIN ANALYZE results.
 * Follows the same overlay pattern as OptimizationModal.
 */
import { useState } from 'react';
import { X, Terminal, AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { SQLExplainPlanResponse } from '../../services/sqlService';

interface ExplainBlockProps {
  isOpen: boolean;
  result: SQLExplainPlanResponse | null;
  isLoading?: boolean;
  onClose: () => void;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MySQLExplainTable({ columns, rows }: { columns: string[]; rows: Record<string, any>[] }) {
  const typeColor = (val: string) => {
    const v = (val || '').toLowerCase();
    if (v === 'all') return 'text-red-600 dark:text-red-400 font-semibold';
    if (v === 'index') return 'text-orange-600 dark:text-amber-400 font-semibold';
    if (v === 'range') return 'text-amber-600 dark:text-yellow-400';
    if (['ref', 'eq_ref', 'const', 'system'].includes(v))
      return 'text-emerald-700 dark:text-green-400 font-semibold';
    return '';
  };
  const extraColor = (val: string) => {
    const v = (val || '').toLowerCase();
    if (v.includes('using filesort') || v.includes('using temporary'))
      return 'text-red-600 dark:text-red-300';
    if (v.includes('using index')) return 'text-emerald-700 dark:text-green-300';
    return '';
  };

  if (!rows.length)
    return (
      <p className="text-text-muted-DEFAULT dark:text-text-muted-dark text-sm italic p-4">
        No rows returned.
      </p>
    );

  return (
    <div className="w-max min-w-full">
      <table className="w-full text-sm border-collapse font-mono">
        <thead>
          <tr className="border-b border-border-DEFAULT dark:border-border-dark">
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left text-text-muted-DEFAULT dark:text-text-muted-dark uppercase tracking-wide whitespace-nowrap bg-gray-100 dark:bg-surface-dark text-xs font-semibold"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={cn(
                'border-b border-border-DEFAULT dark:border-border-dark transition-colors',
                i % 2 === 0
                  ? 'bg-white dark:bg-background-dark'
                  : 'bg-gray-50 dark:bg-surface-dark',
                'hover:bg-blue-50 dark:hover:bg-blue-900/10'
              )}
            >
              {columns.map((col) => {
                const val =
                  row[col] === null || row[col] === undefined ? 'NULL' : String(row[col]);
                const colLower = col.toLowerCase();
                let extraClass = 'text-gray-700 dark:text-gray-300';
                if (colLower === 'type') extraClass = typeColor(val) || 'text-gray-700 dark:text-gray-300';
                else if (colLower === 'extra') extraClass = extraColor(val) || 'text-gray-700 dark:text-gray-300';
                else if (colLower === 'key' && val !== 'NULL')
                  extraClass = 'text-blue-600 dark:text-blue-400 font-medium';
                else if (val === 'NULL')
                  extraClass = 'text-gray-400 dark:text-gray-600';

                return (
                  <td key={col} className={cn('px-3 py-2 whitespace-nowrap', extraClass)}>
                    {val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MySQLAnalyzeTree({ rows }: { rows: Record<string, any>[] }) {
  const lines = rows.map((r) => String(r['Plan'] ?? Object.values(r)[0] ?? ''));
  return (
    <div className="bg-gray-50 dark:bg-[#1e1e1e] p-5 rounded font-mono text-sm text-gray-900 dark:text-[#d4d4d4] w-max min-w-full leading-relaxed">
      {lines.map((line, i) => (
        <div
          key={i}
          className={cn(
            'whitespace-pre py-0.5',
            line.includes('actual') && 'text-teal-700 dark:text-[#4ec9b0] font-medium',
            line.includes('cost=') && !line.includes('actual') && 'text-amber-700 dark:text-[#dcdcaa]'
          )}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

function PostgresExplainTree({ rows }: { rows: Record<string, any>[] }) {
  const lines = rows.map((r) => String(r['QUERY PLAN'] ?? Object.values(r)[0] ?? ''));
  return (
    <div className="bg-gray-50 dark:bg-[#1e1e1e] p-5 rounded font-mono text-sm text-gray-900 dark:text-[#d4d4d4] space-y-0.5 w-max min-w-full leading-relaxed">
      {lines.map((line, i) => (
        <div
          key={i}
          className={cn(
            'whitespace-pre py-0.5',
            line.includes('Seq Scan') && 'text-red-600 dark:text-[#f48771] font-medium',
            line.includes('Index Scan') && !line.includes('Seq Scan') && 'text-teal-700 dark:text-[#4ec9b0] font-medium',
            line.includes('actual time=') && 'text-sky-700 dark:text-[#9cdcfe]',
            /cost=\d/.test(line) &&
              !line.includes('Seq Scan') &&
              !line.includes('Index Scan') &&
              !line.includes('actual') &&
              'text-amber-700 dark:text-[#dcdcaa]',
            (line.includes('Hash') || line.includes('Join')) &&
              !line.includes('Seq Scan') &&
              !line.includes('Index Scan') &&
              'text-violet-700 dark:text-[#c586c0]'
          )}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

function SQLiteQueryPlanTable({ rows }: { rows: Record<string, any>[] }) {
  const allRows = rows.filter((r) => {
    const d = String(r['detail'] ?? Object.values(r)[3] ?? '');
    return d !== '---';
  });
  const statRows = allRows.filter((r) =>
    String(r['detail'] ?? Object.values(r)[3] ?? '').startsWith('[Execution')
  );
  const planRows = allRows.filter(
    (r) => !String(r['detail'] ?? Object.values(r)[3] ?? '').startsWith('[Execution')
  );

  return (
    <div className="space-y-4 p-4">
      <div>
        <p className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark mb-2 font-semibold uppercase tracking-wide">
          Query Plan Steps
        </p>
        <div className="w-max min-w-full">
          <table className="w-full text-sm border-collapse font-mono">
            <thead>
              <tr className="border-b border-border-DEFAULT dark:border-border-dark">
                <th className="px-3 py-2 text-left text-text-muted-DEFAULT dark:text-text-muted-dark bg-gray-100 dark:bg-surface-dark w-8" />
                <th className="px-3 py-2 text-left text-text-muted-DEFAULT dark:text-text-muted-dark bg-gray-100 dark:bg-surface-dark text-xs font-semibold uppercase tracking-wide">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              {planRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="px-3 py-4 text-center text-text-muted-DEFAULT dark:text-text-muted-dark italic"
                  >
                    No plan output
                  </td>
                </tr>
              ) : (
                planRows.map((row, i) => {
                  const detail = String(row['detail'] ?? Object.values(row)[3] ?? '');
                  const lower = detail.toLowerCase();
                  return (
                    <tr
                      key={i}
                      className={cn(
                        'border-b border-border-DEFAULT dark:border-border-dark',
                        i % 2 === 0
                          ? 'bg-white dark:bg-background-dark'
                          : 'bg-gray-50 dark:bg-surface-dark'
                      )}
                    >
                      <td className="px-3 py-2 text-text-muted-DEFAULT dark:text-text-muted-dark">
                        <ChevronRight className="w-3 h-3 inline" />
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2',
                          lower.includes('scan') && !lower.includes('index')
                            ? 'text-orange-600 dark:text-amber-400'
                            : lower.includes('index')
                              ? 'text-emerald-700 dark:text-green-400'
                              : lower.includes('search')
                                ? 'text-blue-600 dark:text-primary-dark'
                                : 'text-gray-800 dark:text-gray-200'
                        )}
                      >
                        {detail}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {statRows.map((row, i) => {
        const detail = String(row['detail'] ?? Object.values(row)[3] ?? '');
        const isError = detail.includes('ERROR');
        return (
          <div
            key={i}
            className={cn(
              'flex items-center gap-2 text-sm px-3 py-2 rounded border',
              isError
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                : 'bg-emerald-50 dark:bg-green-900/20 border-emerald-200 dark:border-green-800 text-emerald-800 dark:text-green-400'
            )}
          >
            <span className="font-mono">{detail}</span>
          </div>
        );
      })}
    </div>
  );
}

function UnavailableNotice({ reason }: { reason: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg m-4 text-sm text-amber-800 dark:text-amber-400">
      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{reason}</span>
    </div>
  );
}

function MySQLLegend() {
  const items = [
    { label: 'ALL', desc: 'Full table scan', cls: 'text-red-600 dark:text-red-400' },
    { label: 'index', desc: 'Full index scan', cls: 'text-orange-600 dark:text-amber-400' },
    { label: 'range', desc: 'Index range scan', cls: 'text-amber-600 dark:text-yellow-400' },
    { label: 'ref/eq_ref', desc: 'Index lookup', cls: 'text-emerald-700 dark:text-green-400' },
  ];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-4 py-3 border-t border-border-DEFAULT dark:border-border-dark text-xs bg-gray-50 dark:bg-background-dark">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span className={cn('font-mono font-bold', it.cls)}>{it.label}</span>
          <span className="text-gray-500 dark:text-text-muted-dark">— {it.desc}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function ExplainBlock({ isOpen, result, isLoading, onClose }: ExplainBlockProps) {
  const [activeTab, setActiveTab] = useState<'explain' | 'analyze'>('explain');

  if (!isOpen) return null;

  const dbLabel: Record<string, string> = {
    postgresql: 'PostgreSQL',
    mysql: 'MySQL',
    postgresql_sandbox: 'PostgreSQL Sandbox',
    simulation: 'Legacy Sandbox',
  };

  // Loading overlay
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div
          className={cn(
            'relative w-full max-w-3xl rounded-xl shadow-2xl p-8',
            'bg-white dark:bg-surface-dark',
            'border border-gray-200 dark:border-border-dark'
          )}
        >
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-primary dark:border-primary-dark border-t-transparent rounded-full animate-spin" />
            <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark mt-4">
              Analyzing query plan...
            </h3>
            <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark mt-2">
              Running EXPLAIN on your database
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const showAnalyzeTab = result.db_type !== 'simulation';

  const renderExplain = () => {
    if (result.db_type === 'simulation') {
      return <SQLiteQueryPlanTable rows={result.explain_rows} />;
    }
    if (result.db_type === 'mysql') {
      return (
        <>
          <MySQLExplainTable columns={result.explain_columns} rows={result.explain_rows} />
          <MySQLLegend />
        </>
      );
    }
    return <PostgresExplainTree rows={result.explain_rows} />;
  };

  const renderAnalyze = () => {
    if (!result.analyze_available) {
      return (
        <UnavailableNotice
          reason={result.analyze_unavailable_reason ?? 'EXPLAIN ANALYZE is not available.'}
        />
      );
    }
    if (result.db_type === 'mysql') {
      return <MySQLAnalyzeTree rows={result.analyze_rows!} />;
    }
    return <PostgresExplainTree rows={result.analyze_rows!} />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={cn(
          // Fixed tall height: min 72vh, max 92vh — stable regardless of content
          'relative w-full max-w-[92vw] h-[82vh] rounded-xl shadow-2xl overflow-hidden',
          'bg-white dark:bg-surface-dark',
          'border border-gray-200 dark:border-border-dark',
          'flex flex-col'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-border-dark bg-gray-50 dark:bg-surface-highlight-dark/30 flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <Terminal className="w-5 h-5 text-primary dark:text-primary-dark" />
            <h2 className="text-lg font-bold text-text-main-DEFAULT dark:text-text-main-dark">
              Query Execution Plan
            </h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 dark:bg-primary-dark/10 text-primary dark:text-primary-dark border border-primary/20 dark:border-primary-dark/20 font-medium">
              {dbLabel[result.db_type] ?? result.db_type}
            </span>
            {result.execution_time_ms != null && (
              <span className="text-xs text-gray-600 dark:text-text-muted-dark bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full font-mono font-medium">
                {result.execution_time_ms.toFixed(2)} ms
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-surface-highlight-dark transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-text-muted-dark" />
          </button>
        </div>

        {/* Tabs — only for MySQL / Postgres */}
        {showAnalyzeTab && (
          <div className="flex border-b border-gray-200 dark:border-border-dark text-sm bg-gray-50 dark:bg-background-dark flex-shrink-0">
            {(['explain', 'analyze'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 px-6 py-3 font-semibold tracking-wide transition-colors flex items-center justify-center gap-2',
                  activeTab === tab
                    ? 'border-b-2 border-primary dark:border-primary-dark text-primary dark:text-primary-dark bg-white dark:bg-surface-dark'
                    : 'text-gray-500 dark:text-text-muted-dark hover:bg-gray-100 dark:hover:bg-surface-highlight-dark hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                {tab === 'explain' ? 'EXPLAIN' : 'EXPLAIN ANALYZE'}
                {tab === 'analyze' && !result.analyze_available && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 leading-none">
                    N/A
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Content — both tabs rendered, toggled via visibility to prevent height jump */}
        <div className="flex-1 overflow-auto bg-white dark:bg-background-dark min-h-0">
          {/* Explain tab */}
          <div className={cn(!showAnalyzeTab || activeTab === 'explain' ? 'block' : 'hidden')}>
            {renderExplain()}
          </div>
          {/* Analyze tab — always mounted to avoid layout shift */}
          {showAnalyzeTab && (
            <div className={cn(activeTab === 'analyze' ? 'block' : 'hidden')}>
              {renderAnalyze()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-border-dark bg-gray-50 dark:bg-surface-highlight-dark/30 px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-end">
            <button
              onClick={onClose}
              className={cn(
                'px-5 py-2 rounded-lg font-medium transition-colors text-sm',
                'border border-gray-300 dark:border-border-dark',
                'text-gray-700 dark:text-text-main-dark',
                'hover:bg-gray-100 dark:hover:bg-surface-highlight-dark'
              )}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}