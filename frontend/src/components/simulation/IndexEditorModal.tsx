/**
 * IndexEditorModal Component
 * Modal for creating and editing table indexes
 */
import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { IndexDef, SimulationColumn } from '../../types/simulation';

interface IndexEditorModalProps {
  index?: IndexDef; // If editing, pass the existing index
  columns: SimulationColumn[];
  isReadOnly?: boolean;
  onClose: () => void;
  onSave: (index: Omit<IndexDef, 'id'>) => void;
  onDelete?: () => void;
}

export function IndexEditorModal({
  index,
  columns,
  isReadOnly = false,
  onClose,
  onSave,
  onDelete,
}: IndexEditorModalProps) {
  const [indexName, setIndexName] = useState(index?.name || '');
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(index?.columns || [])
  );
  const [isUnique, setIsUnique] = useState(index?.unique || false);

  const isEditing = !!index;

  const handleToggleColumn = (columnId: string) => {
    const newSelected = new Set(selectedColumns);
    if (newSelected.has(columnId)) {
      newSelected.delete(columnId);
    } else {
      newSelected.add(columnId);
    }
    setSelectedColumns(newSelected);
  };

  const handleSave = () => {
    if (!indexName.trim()) {
      alert('Please enter an index name');
      return;
    }

    if (selectedColumns.size === 0) {
      alert('Please select at least one column');
      return;
    }

    onSave({
      name: indexName.trim(),
      columns: Array.from(selectedColumns),
      unique: isUnique,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={cn(
        'bg-surface-light dark:bg-surface-dark',
        'border border-border-DEFAULT dark:border-border-dark',
        'rounded-xl shadow-xl max-w-lg w-full mx-4',
        'flex flex-col max-h-[80vh]'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-DEFAULT dark:border-border-dark">
          <h3 className="text-xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
            {isEditing ? (isReadOnly ? 'View Index' : 'Edit Index') : 'Create Index'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Index Name */}
          <div>
            <label className="block text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark mb-2">
              Index Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={indexName}
              onChange={(e) => setIndexName(e.target.value)}
              readOnly={isReadOnly}
              placeholder="idx_column_name"
              className={cn(
                'w-full px-4 py-2 rounded-lg border',
                'bg-background-light dark:bg-background-dark',
                'border-border-DEFAULT dark:border-border-dark',
                'text-text-main-DEFAULT dark:text-text-main-dark',
                'focus:outline-none focus:ring-2 focus:ring-primary/50',
                'disabled:opacity-50'
              )}
            />
          </div>

          {/* Unique Checkbox */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is-unique"
              checked={isUnique}
              onChange={(e) => setIsUnique(e.target.checked)}
              disabled={isReadOnly}
              className="w-5 h-5 rounded border-border-DEFAULT dark:border-border-dark"
            />
            <label
              htmlFor="is-unique"
              className="text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark cursor-pointer"
            >
              Unique Index
            </label>
          </div>

          {/* Columns Selection */}
          <div>
            <label className="block text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark mb-3">
              Select Columns <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto border border-border-DEFAULT dark:border-border-dark rounded-lg p-3">
              {columns.length === 0 ? (
                <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark text-center py-4">
                  No columns available. Please add columns first.
                </p>
              ) : (
                columns.map((column) => (
                  <label
                    key={column.id}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg cursor-pointer',
                      'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark',
                      'transition-colors'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedColumns.has(column.id)}
                      onChange={() => handleToggleColumn(column.id)}
                      disabled={isReadOnly}
                      className="w-4 h-4 rounded border-border-DEFAULT dark:border-border-dark"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark font-mono">
                        {column.name}
                      </span>
                      <span className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark ml-2">
                        ({column.type})
                      </span>
                    </div>
                  </label>
                ))
              )}
            </div>
            <p className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark mt-2">
              Selected: {selectedColumns.size} column{selectedColumns.size !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border-DEFAULT dark:border-border-dark">
          <div>
            {isEditing && onDelete && !isReadOnly && (
              <button
                onClick={onDelete}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg',
                  'bg-red-500 text-white',
                  'hover:bg-red-600',
                  'transition-colors font-medium'
                )}
              >
                <Trash2 className="w-4 h-4" />
                Delete Index
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className={cn(
                'px-4 py-2 rounded-lg font-medium',
                'bg-surface-highlight-light dark:bg-surface-highlight-dark',
                'hover:bg-surface-highlight-DEFAULT dark:hover:bg-surface-highlight-dark',
                'text-text-main-DEFAULT dark:text-text-main-dark',
                'transition-colors'
              )}
            >
              Cancel
            </button>
            {!isReadOnly && (
              <button
                onClick={handleSave}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg font-medium',
                  'bg-primary dark:bg-primary-dark text-white',
                  'hover:bg-primary-hover dark:hover:bg-primary-dark-hover',
                  'transition-colors'
                )}
              >
                <Plus className="w-4 h-4" />
                {isEditing ? 'Update Index' : 'Create Index'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
