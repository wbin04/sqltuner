/**
 * StructureEditor Component
 * Editor for table structure (columns, types, constraints)
 */
import { useState, useEffect } from 'react';
import { Plus, Trash2, Link, Edit2, Check, X, List } from 'lucide-react';
import { cn, parseSQLType, constructSQLType } from '../../lib/utils';
import { SimulationTable, SimulationColumn, ColumnType, SimulationSchema, IndexDef } from '../../types/simulation';
import { v4 as uuidv4 } from 'uuid';
import { ForeignKeyModal } from '../simulation/ForeignKeyModal';
import { IndexEditorModal } from '../simulation/IndexEditorModal';

interface StructureEditorProps {
  table: SimulationTable;
  schema: SimulationSchema;
  isReadOnly?: boolean;
  onUpdateTable: (table: SimulationTable) => void;
}

export function StructureEditor({ table, schema, isReadOnly = false, onUpdateTable }: StructureEditorProps) {
  const [editingTableName, setEditingTableName] = useState(false);
  const [tableName, setTableName] = useState(table.name);
  const [fkModalColumn, setFkModalColumn] = useState<SimulationColumn | null>(null);
  const [indexModal, setIndexModal] = useState<{ mode: 'create' | 'edit'; index?: IndexDef } | null>(null);
  const [columnTypeStates, setColumnTypeStates] = useState<Record<string, { baseType: string; args: string }>>({});

  // Initialize column type states when table changes
  useEffect(() => {
    const newStates: Record<string, { baseType: string; args: string }> = {};
    
    table.columns.forEach(column => {
      const parsed = parseSQLType(column.type);
      
      newStates[column.id] = {
        baseType: parsed.type,
        args: parsed.args || ''
      };
    });
    
    setColumnTypeStates(newStates);
  }, [table.columns]);

  // Update tableName when table changes (user selects different table)
  useEffect(() => {
    setTableName(table.name);
    setEditingTableName(false); // Reset editing state when switching tables
  }, [table.id, table.name]);

  const handleAddColumn = () => {
    const newColumn: SimulationColumn = {
      id: uuidv4(),
      name: `column_${table.columns.length + 1}`,
      type: 'VARCHAR',
      is_pk: false,
      is_nullable: true,
      fk_target: null,
    };

    // Update table first
    const updatedTable = {
      ...table,
      columns: [...table.columns, newColumn],
    };
    onUpdateTable(updatedTable);

    // Initialize type state for new column
    setColumnTypeStates(prev => ({
      ...prev,
      [newColumn.id]: {
        baseType: 'VARCHAR',
        args: ''
      }
    }));
  };

  const handleDeleteColumn = (columnId: string) => {
    if (table.columns.length === 1) {
      alert('Cannot delete the last column');
      return;
    }

    onUpdateTable({
      ...table,
      columns: table.columns.filter(c => c.id !== columnId),
    });
  };

  const handleUpdateColumn = (columnId: string, updates: Partial<SimulationColumn>) => {
    onUpdateTable({
      ...table,
      columns: table.columns.map(c =>
        c.id === columnId ? { ...c, ...updates } : c
      ),
    });
  };

  const handleUpdateColumnType = (columnId: string, baseType: string, args: string) => {
    const fullType = constructSQLType(baseType, args || null);
    
    // Update column type states
    setColumnTypeStates(prev => ({
      ...prev,
      [columnId]: { baseType, args }
    }));
    
    // Update the actual column
    handleUpdateColumn(columnId, { type: fullType });
  };

  const handleSaveTableName = () => {
    if (tableName.trim()) {
      onUpdateTable({ ...table, name: tableName.trim() });
    }
    setEditingTableName(false);
  };

  const getFKInfo = (column: SimulationColumn) => {
    if (!column.fk_target) return null;

    const refTable = schema.tables.find(t => t.id === column.fk_target!.table_id);
    const refColumn = refTable?.columns.find(c => c.id === column.fk_target!.column_id);

    return refTable && refColumn ? `${refTable.name}.${refColumn.name}` : null;
  };

  const handleAddIndex = (indexData: Omit<IndexDef, 'id'>) => {
    const newIndex: IndexDef = {
      id: uuidv4(),
      ...indexData,
    };

    onUpdateTable({
      ...table,
      indexes: [...(table.indexes || []), newIndex],
    });
    setIndexModal(null);
  };

  const handleUpdateIndex = (indexData: Omit<IndexDef, 'id'>) => {
    if (!indexModal?.index) return;

    onUpdateTable({
      ...table,
      indexes: (table.indexes || []).map(idx =>
        idx.id === indexModal.index!.id ? { ...idx, ...indexData } : idx
      ),
    });
    setIndexModal(null);
  };

  const handleDeleteIndex = (indexId: string) => {
    if (confirm('Are you sure you want to delete this index?')) {
      onUpdateTable({
        ...table,
        indexes: (table.indexes || []).filter(idx => idx.id !== indexId),
      });
      setIndexModal(null);
    }
  };

  const getColumnNameById = (columnId: string) => {
    return table.columns.find(c => c.id === columnId)?.name || columnId;
  };

  return (
    <div className="p-6">
      {/* Table Name Editor */}
      <div className="mb-6">
        {editingTableName ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTableName();
                if (e.key === 'Escape') {
                  setTableName(table.name);
                  setEditingTableName(false);
                }
              }}
              className={cn(
                'text-2xl font-bold px-3 py-1 rounded-lg border',
                'bg-background-light dark:bg-background-dark',
                'border-border-DEFAULT dark:border-border-dark',
                'text-text-main-DEFAULT dark:text-text-main-dark',
                'focus:outline-none focus:ring-2 focus:ring-primary/50'
              )}
              autoFocus
            />
            <button
              onClick={handleSaveTableName}
              className="p-2 rounded-lg bg-green-500 text-white hover:bg-green-600"
            >
              <Check className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setTableName(table.name);
                setEditingTableName(false);
              }}
              className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
              Table: {table.name}
            </h3>
            <button
              onClick={() => setEditingTableName(true)}
              disabled={isReadOnly}
              className="p-1 rounded hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark disabled:hidden disabled:cursor-not-allowed"
            >
              <Edit2 className="w-4 h-4 text-text-muted-DEFAULT dark:text-text-muted-dark" />
            </button>
          </div>
        )}
      </div>

      {/* Columns Table */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-highlight-light dark:bg-surface-highlight-dark">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted-DEFAULT dark:text-text-muted-dark uppercase">
                Column Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted-DEFAULT dark:text-text-muted-dark uppercase">
                Data Type
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-text-muted-DEFAULT dark:text-text-muted-dark uppercase">
                Primary Key
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-text-muted-DEFAULT dark:text-text-muted-dark uppercase">
                Nullable
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted-DEFAULT dark:text-text-muted-dark uppercase">
                Foreign Key
              </th>
              <th className={cn("px-4 py-3 text-center text-xs font-semibold text-text-muted-DEFAULT dark:text-text-muted-dark uppercase w-20", isReadOnly ? "hidden" : "")}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {table.columns.map((column) => (
              <tr
                key={column.id}
                className="border-t border-border-DEFAULT dark:border-border-dark hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark"
              >
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={column.name}
                    onChange={(e) => handleUpdateColumn(column.id, { name: e.target.value })}
                    readOnly={isReadOnly}
                    className={cn(
                      'w-full px-3 py-1.5 rounded border font-mono text-sm',
                      'bg-background-light dark:bg-background-dark',
                      'border-border-DEFAULT dark:border-border-dark',
                      'text-text-main-DEFAULT dark:text-text-main-dark',
                      'focus:outline-none focus:ring-2 focus:ring-primary/50'
                    )}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <select
                      value={columnTypeStates[column.id]?.baseType || 'VARCHAR'}
                      onChange={(e) => {
                        const newBaseType = e.target.value;
                        const currentArgs = columnTypeStates[column.id]?.args || '';
                        handleUpdateColumnType(column.id, newBaseType, currentArgs);
                      }}
                      disabled={isReadOnly}
                      className={cn(
                        'flex-1 px-2 py-1.5 rounded border text-sm',
                        'bg-background-light dark:bg-background-dark',
                        'border-border-DEFAULT dark:border-border-dark',
                        'text-text-main-DEFAULT dark:text-text-main-dark',
                        'focus:outline-none focus:ring-2 focus:ring-primary/50'
                      )}
                    >
                      {Object.values(ColumnType).map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {(columnTypeStates[column.id]?.baseType === 'VARCHAR' || 
                      columnTypeStates[column.id]?.baseType === 'DECIMAL') && (
                      <input
                        type="text"
                        placeholder={columnTypeStates[column.id]?.baseType === 'VARCHAR' ? "255" : "10,2"}
                        value={columnTypeStates[column.id]?.args || ''}
                        onChange={(e) => {
                          const newArgs = e.target.value;
                          const currentBaseType = columnTypeStates[column.id]?.baseType || 'VARCHAR';
                          handleUpdateColumnType(column.id, currentBaseType, newArgs);
                        }}
                        disabled={isReadOnly}
                        className={cn(
                          'w-20 px-2 py-1.5 rounded border text-sm font-mono',
                          'bg-background-light dark:bg-background-dark',
                          'border-border-DEFAULT dark:border-border-dark',
                          'text-text-main-DEFAULT dark:text-text-main-dark',
                          'focus:outline-none focus:ring-2 focus:ring-primary/50'
                        )}
                      />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={column.is_pk}
                    onChange={(e) => handleUpdateColumn(column.id, { is_pk: e.target.checked })}
                    disabled={isReadOnly}
                    className="w-4 h-4 rounded border-border-DEFAULT dark:border-border-dark"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={column.is_nullable}
                    onChange={(e) => handleUpdateColumn(column.id, { is_nullable: e.target.checked })}
                    className="w-4 h-4 rounded border-border-DEFAULT dark:border-border-dark"
                    disabled={column.is_pk || isReadOnly}
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setFkModalColumn(column)}
                    disabled={isReadOnly && !getFKInfo(column)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors w-full disabled:hidden',
                      column.fk_target
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20'
                        : 'bg-surface-highlight-light dark:bg-surface-highlight-dark text-text-muted-DEFAULT dark:text-text-muted-dark hover:bg-surface-highlight-DEFAULT dark:hover:bg-surface-highlight-dark'
                    )}
                  >
                    <Link className="w-3.5 h-3.5" />
                    <span className="truncate">
                      {getFKInfo(column) || 'Configure'}
                    </span>
                  </button>
                </td>
                <td className={cn("px-4 py-3 text-center", isReadOnly ? "hidden" : "")}>
                  <button
                    onClick={() => handleDeleteColumn(column.id)}
                    disabled={isReadOnly}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors disabled:hidden disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Column Button */}
      <button
        onClick={handleAddColumn}
        disabled={isReadOnly}
        className={cn(
          'mt-4 flex items-center gap-2 px-4 py-2 rounded-lg',
          'text-primary dark:text-primary-dark',
          'hover:bg-primary/5 dark:hover:bg-primary-dark/5',
          'transition-colors font-medium',
          'disabled:hidden disabled:cursor-not-allowed'
        )}
      >
        <Plus className="w-4 h-4" />
        Add Column
      </button>

      {/* Indexes Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-bold text-text-main-DEFAULT dark:text-text-main-dark flex items-center gap-2">
            <List className="w-5 h-5" />
            Indexes ({(table.indexes || []).length})
          </h4>
          {!isReadOnly && (
            <button
              onClick={() => setIndexModal({ mode: 'create' })}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg',
                'text-sm font-medium text-white',
                'bg-primary dark:bg-primary-dark',
                'hover:bg-primary-hover dark:hover:bg-primary-dark-hover',
                'transition-colors'
              )}
            >
              <Plus className="w-4 h-4" />
              Add Index
            </button>
          )}
        </div>

        {(table.indexes || []).length === 0 ? (
          <div className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center',
            'border-border-DEFAULT dark:border-border-dark'
          )}>
            <List className="w-12 h-12 mx-auto mb-3 text-text-muted-DEFAULT dark:text-text-muted-dark opacity-40" />
            <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">
              No indexes defined yet
            </p>
            {!isReadOnly && (
              <button
                onClick={() => setIndexModal({ mode: 'create' })}
                className={cn(
                  'mt-4 px-4 py-2 rounded-lg',
                  'text-primary dark:text-primary-dark',
                  'hover:bg-primary/5 dark:hover:bg-primary-dark/5',
                  'transition-colors font-medium'
                )}
              >
                Create your first index
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {(table.indexes || []).map((index) => (
              <div
                key={index.id}
                className={cn(
                  'p-4 rounded-lg border',
                  'bg-surface-light dark:bg-surface-dark',
                  'border-border-DEFAULT dark:border-border-dark',
                  'hover:border-primary dark:hover:border-primary-dark',
                  'transition-colors'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h5 className="font-mono font-semibold text-text-main-DEFAULT dark:text-text-main-dark">
                        {index.name}
                      </h5>
                      {index.unique && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          UNIQUE
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {index.columns.map((colId) => (
                        <span
                          key={colId}
                          className="px-2 py-1 rounded text-xs font-mono bg-surface-highlight-light dark:bg-surface-highlight-dark text-text-main-DEFAULT dark:text-text-main-dark"
                        >
                          {getColumnNameById(colId)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setIndexModal({ mode: 'edit', index })}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        isReadOnly
                          ? 'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark'
                          : 'text-primary dark:text-primary-dark hover:bg-primary/10 dark:hover:bg-primary-dark/10'
                      )}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!isReadOnly && (
                      <button
                        onClick={() => handleDeleteIndex(index.id)}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Foreign Key Modal */}
      {fkModalColumn && (
        <ForeignKeyModal
          column={fkModalColumn}
          schema={schema}
          currentTableId={table.id}
          isReadOnly={isReadOnly}
          onClose={() => setFkModalColumn(null)}
          onSave={(fkTarget: { table_id: string; column_id: string } | null) => {
            handleUpdateColumn(fkModalColumn.id, { fk_target: fkTarget });
            setFkModalColumn(null);
          }}
        />
      )}

      {/* Index Editor Modal */}
      {indexModal && (
        <IndexEditorModal
          index={indexModal.index}
          columns={table.columns}
          isReadOnly={isReadOnly}
          onClose={() => setIndexModal(null)}
          onSave={(indexData) => {
            if (indexModal.mode === 'create') {
              handleAddIndex(indexData);
            } else {
              handleUpdateIndex(indexData);
            }
          }}
          onDelete={indexModal.index ? () => handleDeleteIndex(indexModal.index!.id) : undefined}
        />
      )}
    </div>
  );
}
