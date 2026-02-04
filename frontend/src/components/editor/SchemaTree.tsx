import { useState } from 'react';
import { ChevronRight, ChevronDown, Table2, Key, Link as LinkIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TableSchema } from '../../types';

interface SchemaTreeProps {
  tables: TableSchema[];
  onTableClick?: (tableName: string) => void;
}

export function SchemaTree({ tables }: SchemaTreeProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const toggleTable = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-2">
      {tables.length === 0 ? (
        <div className="text-center py-8">
          <Table2 className="w-12 h-12 text-text-muted-DEFAULT dark:text-text-muted-dark mx-auto mb-3 opacity-50" />
          <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">No schema loaded</p>
        </div>
      ) : (
        tables.map(table => {
          const isExpanded = expandedTables.has(table.table_name);

          return (
            <div key={table.table_name} className="space-y-1">
              {/* Table Header */}
              <button
                onClick={() => toggleTable(table.table_name)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
                  'hover:bg-slate-100 dark:hover:bg-midnight-800 transition-colors text-left group'
                )}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-text-muted-DEFAULT dark:text-text-muted-dark flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-text-muted-DEFAULT dark:text-text-muted-dark flex-shrink-0" />
                )}
                <Table2 className="w-4 h-4 text-primary dark:text-primary-dark flex-shrink-0" />
                <span className="font-medium text-text-main-DEFAULT dark:text-text-main-dark text-sm flex-1 truncate">
                  {table.table_name}
                </span>
                {table.row_count !== undefined && (
                  <span className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
                    {table.row_count.toLocaleString()}
                  </span>
                )}
              </button>

              {/* Columns */}
              {isExpanded && (
                <div className="ml-6 pl-4 border-l border-slate-200 dark:border-midnight-800 space-y-1">
                  {table.columns.map(column => (
                    <div
                      key={column.column_name}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm group"
                    >
                      {column.is_primary_key ? (
                        <Key className="w-3 h-3 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
                      ) : column.is_foreign_key ? (
                        <LinkIcon className="w-3 h-3 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                      ) : (
                        <div className="w-3" />
                      )}
                      <span className="text-text-main-DEFAULT dark:text-text-main-dark font-mono flex-1 truncate">
                        {column.column_name}
                      </span>
                      <span className="text-text-muted-DEFAULT dark:text-text-muted-dark text-xs">
                        {column.data_type}
                      </span>
                      {!column.is_nullable && (
                        <span className="text-xs text-red-400">NOT NULL</span>
                      )}
                    </div>
                  ))}

                  {/* Indexes */}
                  {table.indexes && table.indexes.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-slate-200 dark:border-midnight-800">
                      <div className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark px-3 mb-1">Indexes</div>
                      {table.indexes.map(index => (
                        <div
                          key={index.index_name}
                          className="px-3 py-1 text-xs text-text-muted-DEFAULT dark:text-text-muted-dark font-mono"
                        >
                          {index.index_name}
                          {index.unique && (
                            <span className="ml-2 text-green-600 dark:text-green-400">UNIQUE</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
