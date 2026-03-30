import { useState } from 'react';
import {
  Database,
  ChevronDown,
  ChevronRight,
  Check,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { SchemaGeneratedData } from '../../services/chatService';

interface Props {
  schema: SchemaGeneratedData;
  onApplyToSandbox: (schema: SchemaGeneratedData) => void;
  isSimulationWorkspace: boolean;
}

export function SchemaBlock({
  schema,
  onApplyToSandbox,
  isSimulationWorkspace,
}: Props) {
  const rawTables = Array.isArray(schema?.tables) ? schema.tables : [];
  const safeTables = rawTables
    .map((table, tableIndex) => {
      if (!table || typeof table !== 'object') {
        return null;
      }

      const obj = table as {
        name?: unknown;
        purpose?: unknown;
        design_rationale?: unknown;
        columns?: unknown;
        foreign_keys?: unknown;
        indexes?: unknown;
      };

      const safeColumns = Array.isArray(obj.columns)
        ? obj.columns
            .map((col) => {
              if (!col || typeof col !== 'object') {
                return null;
              }

              const c = col as {
                name?: unknown;
                type?: unknown;
                is_pk?: unknown;
                is_nullable?: unknown;
                default?: unknown;
              };

              return {
                name: typeof c.name === 'string' ? c.name : 'column',
                type: typeof c.type === 'string' ? c.type : 'TEXT',
                is_pk: Boolean(c.is_pk),
                is_nullable: c.is_nullable !== false,
                default: typeof c.default === 'string' || c.default === null
                  ? c.default
                  : null,
              };
            })
            .filter((col): col is NonNullable<typeof col> => col !== null)
        : [];

      const safeForeignKeys = Array.isArray(obj.foreign_keys)
        ? obj.foreign_keys
            .map((fk) => {
              if (!fk || typeof fk !== 'object') {
                return null;
              }

              const f = fk as {
                column?: unknown;
                ref_table?: unknown;
                ref_column?: unknown;
                on_delete?: unknown;
              };

              return {
                column: typeof f.column === 'string' ? f.column : '',
                ref_table: typeof f.ref_table === 'string' ? f.ref_table : '',
                ref_column: typeof f.ref_column === 'string' ? f.ref_column : 'id',
                on_delete: typeof f.on_delete === 'string' ? f.on_delete : undefined,
              };
            })
            .filter((fk): fk is NonNullable<typeof fk> => fk !== null)
        : [];

      const safeIndexes = Array.isArray(obj.indexes)
        ? obj.indexes
            .map((idx) => {
              if (!idx || typeof idx !== 'object') {
                return null;
              }

              const i = idx as {
                name?: unknown;
                column_names?: unknown;
                unique?: unknown;
              };

              return {
                name: typeof i.name === 'string' ? i.name : `idx_${tableIndex}`,
                column_names: Array.isArray(i.column_names)
                  ? i.column_names.filter((cn): cn is string => typeof cn === 'string')
                  : [],
                unique: Boolean(i.unique),
              };
            })
            .filter((idx): idx is NonNullable<typeof idx> => idx !== null)
        : [];

      return {
        name: typeof obj.name === 'string' ? obj.name : `table_${tableIndex + 1}`,
        purpose: typeof obj.purpose === 'string' ? obj.purpose : undefined,
        design_rationale:
          typeof obj.design_rationale === 'string' ? obj.design_rationale : undefined,
        columns: safeColumns,
        foreign_keys: safeForeignKeys,
        indexes: safeIndexes,
      };
    })
    .filter((table): table is NonNullable<typeof table> => table !== null);
  const safeSystemName = schema?.system_name || 'Generated Schema';
  const safeDesignNotes = Array.isArray(schema?.design_notes)
    ? schema.design_notes
    : [];

  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [confirmApply, setConfirmApply] = useState(false);

  const toggleTable = (tableName: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) {
        next.delete(tableName);
      } else {
        next.add(tableName);
      }
      return next;
    });
  };

  const handleApply = () => {
    if (!confirmApply) {
      setConfirmApply(true);
      return;
    }
    if (safeTables.length === 0) {
      return;
    }

    onApplyToSandbox({
      ...schema,
      system_name: safeSystemName,
      tables: safeTables,
      design_notes: safeDesignNotes,
    });
    setConfirmApply(false);
  };

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border',
        'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/30'
      )}
    >
      <div className="flex items-center gap-2 border-b border-purple-200 bg-purple-100 px-4 py-3 dark:border-purple-800 dark:bg-purple-900/40">
        <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
          {safeSystemName}
        </span>
        <span className="ml-auto text-xs text-purple-500 dark:text-purple-400">
          {safeTables.length} tables generated
        </span>
      </div>

      <div className="divide-y divide-purple-100 dark:divide-purple-900">
        {safeTables.map((table) => {
          const isExpanded = expandedTables.has(table.name);
          const fkCols = table.foreign_keys || [];
          const idxs = table.indexes || [];

          return (
            <div key={table.name}>
              <button
                type="button"
                onClick={() => toggleTable(table.name)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-purple-100 dark:hover:bg-purple-900/30"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-purple-400" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-purple-400" />
                )}
                <Database className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {table.name}
                </span>
                <span className="ml-1 text-xs text-gray-400">
                  {table.columns.length} cols
                  {idxs.length > 0 && ` · ${idxs.length} idx`}
                  {fkCols.length > 0 && ` · ${fkCols.length} fk`}
                </span>
                {table.purpose && (
                  <span className="ml-auto max-w-[200px] truncate text-xs italic text-gray-400">
                    {table.purpose}
                  </span>
                )}
              </button>

              {isExpanded && (
                <div className="space-y-1 px-10 pb-3">
                  {table.columns.map((col) => (
                    <div key={col.name} className="flex items-center gap-2 text-xs">
                      <span
                        className={cn(
                          'font-mono',
                          col.is_pk
                            ? 'font-bold text-yellow-600 dark:text-yellow-400'
                            : fkCols.some((fk) => fk.column === col.name)
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-300'
                        )}
                      >
                        {col.name}
                      </span>
                      <span className="font-mono text-gray-400">{col.type}</span>
                      {col.is_pk && (
                        <span className="rounded bg-yellow-100 px-1 py-0.5 text-[10px] font-bold text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400">
                          PK
                        </span>
                      )}
                      {fkCols.some((fk) => fk.column === col.name) && (
                        <span className="rounded bg-blue-100 px-1 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                          FK
                        </span>
                      )}
                      {!col.is_nullable && (
                        <span className="text-[10px] text-gray-400">NOT NULL</span>
                      )}
                    </div>
                  ))}

                  {fkCols.length > 0 && (
                    <div className="mt-2 border-t border-purple-100 pt-2 dark:border-purple-900">
                      {fkCols.map((fk, i) => (
                        <div key={i} className="text-[11px] text-gray-400">
                          {fk.column} {'->'} {fk.ref_table}.{fk.ref_column}
                          {fk.on_delete && ` (ON DELETE ${fk.on_delete})`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {safeDesignNotes.length > 0 && (
        <div className="border-t border-purple-200 bg-amber-50 px-4 py-2 dark:border-purple-800 dark:bg-amber-900/10">
          {safeDesignNotes.map((note, i) => (
            <p key={i} className="text-xs text-amber-600 dark:text-amber-400">• {note}</p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-purple-200 bg-white px-4 py-3 dark:border-purple-800 dark:bg-gray-900">
        {isSimulationWorkspace ? (
          <>
            {confirmApply && (
              <div className="mr-2 flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="h-3.5 w-3.5" />
                Will replace current sandbox schema
              </div>
            )}
            <button
              type="button"
              onClick={handleApply}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors',
                confirmApply ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
              )}
            >
              <Check className="h-3.5 w-3.5" />
              {confirmApply ? 'Confirm Apply' : 'Apply to Sandbox'}
            </button>
            {confirmApply && (
              <button
                type="button"
                onClick={() => setConfirmApply(false)}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            )}
          </>
        ) : (
          <p className="text-xs italic text-gray-400">
            Switch to a Simulation workspace to apply this schema
          </p>
        )}
      </div>
    </div>
  );
}
