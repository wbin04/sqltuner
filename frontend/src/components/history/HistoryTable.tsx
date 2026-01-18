/**
 * HistoryTable Component - TanStack Table implementation for query history
 */
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { 
  Database, 
  Layers, 
  TrendingDown, 
  CheckCircle, 
  AlertTriangle,
  Copy,
  Eye,
  Clock
} from 'lucide-react';
import type { HistoryLog, ActivityType } from '../../types/history';

interface HistoryTableProps {
  data: HistoryLog[];
  onViewDetail: (log: HistoryLog) => void;
  onCopySQL: (sql: string) => void;
}

const ActivityBadge = ({ type }: { type: ActivityType }) => {
  const styles = {
    optimization: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    execution: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    chat: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${styles[type]}`}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  );
};

const WorkspaceBadge = ({ workspace }: { workspace: HistoryLog['workspace'] }) => {
  const isSimulation = workspace.db_type === 'simulation';
  
  return (
    <div className="flex items-center gap-2">
      {isSimulation ? (
        <Layers className="w-4 h-4 text-purple-500" />
      ) : (
        <Database className="w-4 h-4 text-blue-500" />
      )}
      <span className="font-medium text-sm">{workspace.name}</span>
      <span className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
        {workspace.db_type}
      </span>
    </div>
  );
};

const ResultBadge = ({ 
  status, 
  costReduction, 
  executionTime 
}: { 
  status?: string; 
  costReduction?: number; 
  executionTime?: number;
}) => {
  if (!status) return <span className="text-text-muted-DEFAULT dark:text-text-muted-dark text-sm">-</span>;

  if (status === 'optimized' && costReduction !== undefined) {
    return (
      <div className="flex items-center gap-1">
        <TrendingDown className="w-4 h-4 text-green-500" />
        <span className="text-green-600 dark:text-green-400 font-medium text-sm">
          Cost -{costReduction.toFixed(2)}%
        </span>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex items-center gap-1">
        <CheckCircle className="w-4 h-4 text-green-500" />
        <span className="text-green-600 dark:text-green-400 text-sm">Success</span>
        {executionTime && (
          <span className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark ml-2">
            ({executionTime.toFixed(2)}ms)
          </span>
        )}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-1">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <span className="text-red-600 dark:text-red-400 text-sm">Error</span>
      </div>
    );
  }

  return null;
};

export function HistoryTable({ data, onViewDetail, onCopySQL }: HistoryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns: ColumnDef<HistoryLog>[] = [
    {
      accessorKey: 'timestamp',
      header: 'Timestamp',
      cell: ({ row }) => {
        const date = new Date(row.original.timestamp);
        return (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-text-muted-DEFAULT dark:text-text-muted-dark" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
                {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'workspace',
      header: 'Workspace',
      cell: ({ row }) => <WorkspaceBadge workspace={row.original.workspace} />,
    },
    {
      accessorKey: 'activity_type',
      header: 'Type',
      cell: ({ row }) => <ActivityBadge type={row.original.activity_type} />,
    },
    {
      accessorKey: 'activity',
      header: 'Activity',
      cell: ({ row }) => {
        const prompt = row.original.user_prompt;
        const sql = row.original.sql_query;
        const content = prompt || sql || 'No content';
        const truncated = content.length > 100 ? content.substring(0, 100) + '...' : content;
        
        return (
          <div className="max-w-md">
            <p className="text-sm text-text-main-DEFAULT dark:text-text-main-dark truncate">
              {truncated}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: 'result_status',
      header: 'Result',
      cell: ({ row }) => (
        <ResultBadge
          status={row.original.result_status}
          costReduction={row.original.cost_reduction}
          executionTime={row.original.execution_time_ms}
        />
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.sql_query && (
            <button
              onClick={() => onCopySQL(row.original.sql_query!)}
              className="p-2 hover:bg-surface-light dark:hover:bg-surface-dark rounded-md transition-colors"
              title="Copy SQL"
            >
              <Copy className="w-4 h-4 text-text-muted-DEFAULT dark:text-text-muted-dark hover:text-primary" />
            </button>
          )}
          <button
            onClick={() => onViewDetail(row.original)}
            className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-sm font-medium transition-colors"
          >
            <div className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              <span>View</span>
            </div>
          </button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-border-light dark:border-border-dark">
      <table className="w-full">
        <thead className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-6 py-3 text-left text-xs font-medium text-text-muted-DEFAULT dark:text-text-muted-dark uppercase tracking-wider"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="bg-background-light dark:bg-background-dark divide-y divide-border-light dark:divide-border-dark">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.getRowModel().rows.length === 0 && (
        <div className="text-center py-12 bg-background-light dark:bg-background-dark">
          <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">
            No history records found
          </p>
        </div>
      )}
    </div>
  );
}
