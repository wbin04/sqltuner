/**
 * ForeignKeyModal Component
 * Modal for configuring foreign key relationships
 */
import { useState } from 'react';
import { X, Link as LinkIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SimulationColumn, SimulationSchema, ForeignKeyTarget } from '../../types/simulation';

interface ForeignKeyModalProps {
  column: SimulationColumn;
  schema: SimulationSchema;
  currentTableId: string;
  onClose: () => void;
  onSave: (fkTarget: ForeignKeyTarget | null) => void;
}

export function ForeignKeyModal({
  column,
  schema,
  currentTableId,
  onClose,
  onSave,
}: ForeignKeyModalProps) {
  const [selectedTableId, setSelectedTableId] = useState(column.fk_target?.table_id || '');
  const [selectedColumnId, setSelectedColumnId] = useState(column.fk_target?.column_id || '');

  // Filter out current table
  const availableTables = schema.tables.filter(t => t.id !== currentTableId);
  const selectedTable = schema.tables.find(t => t.id === selectedTableId);

  const handleSave = () => {
    if (selectedTableId && selectedColumnId) {
      onSave({ table_id: selectedTableId, column_id: selectedColumnId });
    } else {
      onSave(null); // Remove FK
    }
  };

  const handleRemove = () => {
    onSave(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          'relative w-full max-w-md rounded-xl shadow-2xl',
          'bg-surface-light dark:bg-surface-dark',
          'border border-border-DEFAULT dark:border-border-dark'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-DEFAULT dark:border-border-dark">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-primary dark:text-primary-dark" />
            <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark">
              Configure Foreign Key
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div>
            <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark mb-3">
              Column: <span className="font-mono font-semibold text-text-main-DEFAULT dark:text-text-main-dark">{column.name}</span>
            </p>
          </div>

          {/* Reference Table */}
          <div>
            <label className="block text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark mb-2">
              Reference Table
            </label>
            <select
              value={selectedTableId}
              onChange={(e) => {
                setSelectedTableId(e.target.value);
                setSelectedColumnId('');
              }}
              className={cn(
                'w-full px-3 py-2 rounded-lg border',
                'bg-background-light dark:bg-background-dark',
                'border-border-DEFAULT dark:border-border-dark',
                'text-text-main-DEFAULT dark:text-text-main-dark',
                'focus:outline-none focus:ring-2 focus:ring-primary/50'
              )}
            >
              <option value="">-- Select Table --</option>
              {availableTables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reference Column */}
          {selectedTableId && (
            <div>
              <label className="block text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark mb-2">
                Reference Column
              </label>
              <select
                value={selectedColumnId}
                onChange={(e) => setSelectedColumnId(e.target.value)}
                className={cn(
                  'w-full px-3 py-2 rounded-lg border',
                  'bg-background-light dark:bg-background-dark',
                  'border-border-DEFAULT dark:border-border-dark',
                  'text-text-main-DEFAULT dark:text-text-main-dark',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50'
                )}
              >
                <option value="">-- Select Column --</option>
                {selectedTable?.columns
                  .filter(col => col.is_pk)
                  .map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.name} ({col.type})
                    </option>
                  ))}
              </select>
              {selectedTable && selectedTable.columns.filter(c => c.is_pk).length === 0 && (
                <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                  ⚠️ Selected table has no primary key columns
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4 border-t border-border-DEFAULT dark:border-border-dark">
          {column.fk_target && (
            <button
              onClick={handleRemove}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-colors',
                'bg-red-500 text-white hover:bg-red-600'
              )}
            >
              Remove FK
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              'border border-border-DEFAULT dark:border-border-dark',
              'text-text-main-DEFAULT dark:text-text-main-dark',
              'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedTableId || !selectedColumnId}
            className={cn(
              'px-4 py-2 rounded-lg font-medium text-white transition-colors',
              'bg-primary dark:bg-primary-dark',
              'hover:bg-primary-hover dark:hover:bg-primary-dark-hover',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
