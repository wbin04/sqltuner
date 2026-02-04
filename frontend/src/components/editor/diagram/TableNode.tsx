/**
 * TableNode Component
 * Custom React Flow node for displaying database tables in ERD
 */
import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Table, Key, Link } from 'lucide-react';
import { cn } from '../../../lib/utils';

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
}

export const TableNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as TableNodeData;
  const isEditable = nodeData.isEditable || false;
  
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
        <span className="font-semibold text-text-main-DEFAULT dark:text-text-main-dark">
          {nodeData.tableName}
        </span>
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
            {isEditable && (
              <Handle
                type="target"
                position={Position.Left}
                id={`${nodeData.tableName}__${column.name}__target`}
                className={cn(
                  'w-2.5 h-2.5 !bg-blue-500 dark:!bg-blue-400 !border-2 !border-white dark:!border-gray-800',
                  'opacity-0 group-hover:opacity-100 transition-opacity',
                  '!left-[-8px]'
                )}
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
            )}
            {/* Icons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {column.is_pk && (
                <Key className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
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

            {/* Data Type */}
            <span
              className="text-text-muted-DEFAULT dark:text-text-muted-dark text-xs ml-auto flex-shrink-0"
              title={column.type}
            >
              {column.type.length > 15 ? column.type.substring(0, 12) + '...' : column.type}
            </span>
            
            {/* Column Source Handle (Right) */}
            {isEditable && (
              <Handle
                type="source"
                position={Position.Right}
                id={`${nodeData.tableName}__${column.name}__source`}
                className={cn(
                  'w-2.5 h-2.5 !bg-green-500 dark:!bg-green-400 !border-2 !border-white dark:!border-gray-800',
                  'opacity-0 group-hover:opacity-100 transition-opacity',
                  '!right-[-8px]'
                )}
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Fallback handles for non-editable mode */}
      {!isEditable && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            className="w-3 h-3 !bg-primary dark:!bg-primary-dark"
          />
          <Handle
            type="source"
            position={Position.Right}
            className="w-3 h-3 !bg-primary dark:!bg-primary-dark"
          />
        </>
      )}
    </div>
  );
});

TableNode.displayName = 'TableNode';
