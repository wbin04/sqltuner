/**
 * TableNode Component
 * Custom React Flow node for displaying database tables in ERD
 * Supports inline CRUD operations for columns
 */
import { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Table, Key, Link, Trash2, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Column {
  name: string;
  type: string;
  is_pk?: boolean;
  is_nullable?: boolean;
}

interface ForeignKey {
  column: string;
  ref_table: string;
  ref_column: string;
}

export interface TableNodeData {
  tableName: string;
  columns: Column[];
  foreign_keys?: ForeignKey[];
  isEditable?: boolean;
  onAddColumn?: (tableName: string, column: Column) => void;
  onRemoveColumn?: (tableName: string, columnName: string) => void;
  onUpdateColumn?: (tableName: string, columnName: string, newColumn: Column) => void;
  onUpdateTableName?: (oldName: string, newName: string) => void;
}

// Common SQL data types
const COMMON_TYPES = [
  'VARCHAR',
  'TEXT',
  'INTEGER',
  'BIGINT',
  'DECIMAL',
  'BOOLEAN',
  'DATE',
  'TIMESTAMP',
  'UUID',
  'JSON',
];

export const TableNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as TableNodeData;
  const isEditable = nodeData.isEditable || false;
  
  // State for adding new column
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState('VARCHAR');
  
  // State for editing column type
  const [editingColumnName, setEditingColumnName] = useState<string | null>(null);
  
  // State for editing table name
  const [isEditingTableName, setIsEditingTableName] = useState(false);
  const [editedTableName, setEditedTableName] = useState(nodeData.tableName);
  
  // Sync editedTableName when nodeData.tableName changes from outside
  useEffect(() => {
    setEditedTableName(nodeData.tableName);
  }, [nodeData.tableName]);
  
  const handleAddColumn = () => {
    if (!newColumnName.trim() || !nodeData.onAddColumn) return;
    
    const newColumn: Column = {
      name: newColumnName.trim(),
      type: newColumnType,
      is_pk: false,
      is_nullable: true,
    };
    
    nodeData.onAddColumn(nodeData.tableName, newColumn);
    
    // Reset form
    setNewColumnName('');
    setNewColumnType('VARCHAR');
    setIsAddingColumn(false);
  };
  
  const handleRemoveColumn = (columnName: string) => {
    if (!nodeData.onRemoveColumn) return;
    nodeData.onRemoveColumn(nodeData.tableName, columnName);
  };
  
  const handleUpdateColumnType = (columnName: string, newType: string) => {
    if (!nodeData.onUpdateColumn) return;
    
    const column = nodeData.columns.find(c => c.name === columnName);
    if (!column) return;
    
    const updatedColumn: Column = {
      ...column,
      type: newType,
    };
    
    nodeData.onUpdateColumn(nodeData.tableName, columnName, updatedColumn);
    setEditingColumnName(null);
  };
  
  const handleUpdateTableName = () => {
    if (!nodeData.onUpdateTableName || !editedTableName.trim()) {
      setIsEditingTableName(false);
      setEditedTableName(nodeData.tableName);
      return;
    }
    
    if (editedTableName.trim() !== nodeData.tableName) {
      nodeData.onUpdateTableName(nodeData.tableName, editedTableName.trim());
    }
    setIsEditingTableName(false);
  };
  
  const handleTogglePrimaryKey = (columnName: string) => {
    if (!nodeData.onUpdateColumn) return;
    
    const column = nodeData.columns.find(c => c.name === columnName);
    if (!column) return;
    
    const updatedColumn: Column = {
      ...column,
      is_pk: !column.is_pk,
    };
    
    nodeData.onUpdateColumn(nodeData.tableName, columnName, updatedColumn);
  };
  
  return (
    <div
      className={cn(
        'rounded-lg border shadow-lg min-w-[250px] max-w-[350px]',
        'border-border-DEFAULT dark:border-border-dark',
        'bg-surface-light dark:bg-surface-dark'
      )}
    >

      {/* Table Header */}
      <div
        className={cn(
          'px-4 py-3 rounded-t-lg flex items-center gap-2',
          'bg-gradient-to-r from-primary/10 to-secondary/10',
          'dark:from-primary-dark/10 dark:to-secondary-dark/10',
          'border-b border-border-DEFAULT dark:border-border-dark'
        )}
      >
        <Table className="w-4 h-4 text-primary dark:text-primary-dark flex-shrink-0" />
        {isEditable && isEditingTableName ? (
          <input
            type="text"
            value={editedTableName}
            onChange={(e) => setEditedTableName(e.target.value)}
            onBlur={handleUpdateTableName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleUpdateTableName();
              if (e.key === 'Escape') {
                setIsEditingTableName(false);
                setEditedTableName(nodeData.tableName);
              }
            }}
            autoFocus
            className={cn(
              'flex-1 px-2 py-1 text-sm font-semibold rounded',
              'bg-surface-light dark:bg-surface-dark',
              'border border-border-DEFAULT dark:border-border-dark',
              'text-text-main-DEFAULT dark:text-text-main-dark',
              'focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark'
            )}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={cn(
              'font-semibold text-text-main-DEFAULT dark:text-text-main-dark',
              isEditable && 'cursor-pointer hover:text-primary dark:hover:text-primary-dark'
            )}
            onClick={(e) => {
              if (isEditable) {
                e.stopPropagation();
                setIsEditingTableName(true);
              }
            }}
            title={isEditable ? 'Click to rename' : nodeData.tableName}
          >
            {nodeData.tableName}
          </span>
        )}
      </div>

      {/* Columns List */}
      <div className="px-3 py-2 space-y-1 max-h-[400px] overflow-y-auto">
        {nodeData.columns.map((column, idx) => (
          <div
            key={idx}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded text-sm group relative',
              'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark',
              'transition-colors'
            )}
          >
            {/* Column Target Handle (Left) */}
            <Handle
              type="target"
              position={Position.Left}
              id={`${nodeData.tableName}__${column.name}__target`}
              className={cn(
                'w-2.5 h-2.5 !bg-blue-500 dark:!bg-blue-400 !border-2 !border-white dark:!border-gray-800',
                isEditable 
                  ? 'opacity-0 group-hover:opacity-100 transition-opacity'
                  : 'opacity-0',
                '!left-[-8px]'
              )}
              style={{ top: '50%', transform: 'translateY(-50%)' }}
            />
            
            {/* Icons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {isEditable ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePrimaryKey(column.name);
                  }}
                  className={cn(
                    'p-0.5 rounded hover:bg-surface-light dark:hover:bg-surface-dark',
                    'transition-colors'
                  )}
                  title={column.is_pk ? 'Remove primary key' : 'Set as primary key'}
                >
                  <Key 
                    className={cn(
                      'w-3.5 h-3.5',
                      column.is_pk 
                        ? 'text-yellow-600 dark:text-yellow-400' 
                        : 'text-gray-400 dark:text-gray-600 opacity-50 hover:opacity-100'
                    )} 
                  />
                </button>
              ) : (
                column.is_pk && (
                  <Key className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                )
              )}
              {nodeData.foreign_keys?.some(fk => fk.column === column.name) && (
                <Link className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              )}
            </div>

            {/* Column Name */}
            <span
              className={cn(
                'font-mono text-text-main-DEFAULT dark:text-text-main-dark truncate',
                column.is_pk && 'font-semibold'
              )}
              title={column.name}
            >
              {column.name}
            </span>

            {/* Data Type - Editable in edit mode */}
            {isEditable && editingColumnName === column.name ? (
              <select
                value={column.type}
                onChange={(e) => handleUpdateColumnType(column.name, e.target.value)}
                onBlur={() => setEditingColumnName(null)}
                autoFocus
                className={cn(
                  'text-xs ml-auto flex-shrink-0 px-1 py-0.5 rounded',
                  'bg-surface-light dark:bg-surface-dark',
                  'border border-border-DEFAULT dark:border-border-dark',
                  'text-text-main-DEFAULT dark:text-text-main-dark',
                  'focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark'
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {COMMON_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
                {!COMMON_TYPES.includes(column.type) && (
                  <option value={column.type}>{column.type}</option>
                )}
              </select>
            ) : (
              <span
                className={cn(
                  'text-text-muted-DEFAULT dark:text-text-muted-dark text-xs ml-auto flex-shrink-0',
                  isEditable && 'cursor-pointer hover:text-primary dark:hover:text-primary-dark'
                )}
                title={column.type}
                onClick={(e) => {
                  if (isEditable) {
                    e.stopPropagation();
                    setEditingColumnName(column.name);
                  }
                }}
              >
                {column.type.length > 15 ? column.type.substring(0, 12) + '...' : column.type}
              </span>
            )}
            
            {/* Delete Button - Only in edit mode, allow deleting PK if not the only column */}
            {isEditable && (nodeData.columns.length > 1 || !column.is_pk) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveColumn(column.name);
                }}
                className={cn(
                  'opacity-0 group-hover:opacity-100 transition-opacity',
                  'p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20',
                  'text-red-600 dark:text-red-400'
                )}
                title="Delete column"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            
            {/* Column Source Handle (Right) */}
            <Handle
              type="source"
              position={Position.Right}
              id={`${nodeData.tableName}__${column.name}__source`}
              className={cn(
                'w-2.5 h-2.5 !bg-green-500 dark:!bg-green-400 !border-2 !border-white dark:!border-gray-800',
                isEditable 
                  ? 'opacity-0 group-hover:opacity-100 transition-opacity'
                  : 'opacity-0',
                '!right-[-8px]'
              )}
              style={{ top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>
        ))}
      </div>

      {/* Add Column Footer - Only in edit mode */}
      {isEditable && (
        <div className={cn(
          'px-3 py-2 border-t border-border-DEFAULT dark:border-border-dark',
          'bg-surface-highlight-light dark:bg-surface-highlight-dark'
        )}>
          {isAddingColumn ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddColumn();
                    if (e.key === 'Escape') setIsAddingColumn(false);
                  }}
                  placeholder="Column name"
                  autoFocus
                  className={cn(
                    'flex-1 px-2 py-1 text-sm rounded',
                    'bg-surface-light dark:bg-surface-dark',
                    'border border-border-DEFAULT dark:border-border-dark',
                    'text-text-main-DEFAULT dark:text-text-main-dark',
                    'placeholder:text-text-muted-DEFAULT dark:placeholder:text-text-muted-dark',
                    'focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark'
                  )}
                />
                <select
                  value={newColumnType}
                  onChange={(e) => setNewColumnType(e.target.value)}
                  className={cn(
                    'px-2 py-1 text-sm rounded',
                    'bg-surface-light dark:bg-surface-dark',
                    'border border-border-DEFAULT dark:border-border-dark',
                    'text-text-main-DEFAULT dark:text-text-main-dark',
                    'focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark'
                  )}
                >
                  {COMMON_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setIsAddingColumn(false)}
                  className={cn(
                    'px-3 py-1 text-xs rounded',
                    'text-text-muted-DEFAULT dark:text-text-muted-dark',
                    'hover:bg-surface-light dark:hover:bg-surface-dark'
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddColumn}
                  disabled={!newColumnName.trim()}
                  className={cn(
                    'px-3 py-1 text-xs rounded',
                    'bg-primary dark:bg-primary-dark',
                    'text-white',
                    'hover:opacity-90',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingColumn(true)}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded text-sm',
                'text-primary dark:text-primary-dark',
                'hover:bg-primary/10 dark:hover:bg-primary-dark/10',
                'transition-colors'
              )}
            >
              <Plus className="w-4 h-4" />
              Add Column
            </button>
          )}
        </div>
      )}

      {/* Note: Removed fallback handles since we now have handles for each column */}
    </div>
  );
});

TableNode.displayName = 'TableNode';
