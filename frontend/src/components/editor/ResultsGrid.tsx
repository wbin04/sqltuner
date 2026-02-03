import { Table2, Download } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { QueryResult } from '../../types';

interface ResultsGridProps {
  result: QueryResult | null;
  loading?: boolean;
}

export function ResultsGrid({ result, loading = false }: ResultsGridProps) {
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary dark:border-primary-dark mx-auto mb-4"></div>
          <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">Executing query...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center py-8">
          <Table2 className="w-12 h-12 text-text-muted-DEFAULT dark:text-text-muted-dark mx-auto mb-3 opacity-50" />
          <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">No results yet</p>
          <p className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">Execute a query to see results</p>
        </div>
      </div>
    );
  }

  const exportToCSV = () => {
    if (!result) return;

    const csv = [
      result.columns.join(','),
      ...result.rows.map(row => 
        result.columns.map(col => {
          const value = row[col];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 bg-surface-light dark:bg-midnight-900 border-b border-border-DEFAULT dark:border-midnight-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark">
            {result.rowCount} {result.rowCount === 1 ? 'row' : 'rows'}
          </span>
          {result.executionTime && (
            <span className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
              {result.executionTime}ms
            </span>
          )}
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-midnight-800 text-text-muted-DEFAULT dark:text-text-muted-dark hover:text-text-main-DEFAULT dark:hover:text-text-main-dark transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-light dark:bg-midnight-900 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-text-muted-DEFAULT dark:text-text-muted-dark uppercase tracking-wider border-b border-border-DEFAULT dark:border-midnight-800 w-12">
                #
              </th>
              {result.columns.map((col, idx) => (
                <th
                  key={idx}
                  className="px-4 py-2 text-left text-xs font-medium text-text-muted-DEFAULT dark:text-text-muted-dark uppercase tracking-wider border-b border-border-DEFAULT dark:border-midnight-800"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-DEFAULT dark:divide-midnight-800">
            {result.rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="hover:bg-slate-50 dark:hover:bg-midnight-900/50 transition-colors"
              >
                <td className="px-4 py-2 text-text-muted-DEFAULT dark:text-text-muted-dark text-xs">
                  {rowIdx + 1}
                </td>
                {result.columns.map((col, colIdx) => {
                  const value = row[col];
                  const isNull = value === null || value === undefined;

                  return (
                    <td
                      key={colIdx}
                      className={cn(
                        'px-4 py-2 font-mono text-xs max-w-md truncate',
                        isNull ? 'text-text-muted-DEFAULT dark:text-text-muted-dark italic' : 'text-text-main-DEFAULT dark:text-text-main-dark'
                      )}
                      title={isNull ? 'NULL' : String(value)}
                    >
                      {isNull ? 'NULL' : String(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
