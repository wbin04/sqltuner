/**
 * SchemaViewer Component
 * Displays database schema metadata in a collapsible tree view
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Table, ChevronDown, ChevronRight, Key, Link, Network, Edit, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SchemaDiagramModal } from './diagram/SchemaDiagramModal';
import { workspaceService } from '../../services/workspaceService';

interface Column {
  name: string;
  type: string; // Backend uses 'type' not 'data_type'
  is_nullable?: boolean;
  is_pk?: boolean; // Backend uses 'is_pk' not 'is_primary_key'
}

interface ForeignKey {
  column: string;
  ref_table: string; // Backend uses 'ref_table' not 'referenced_table'
  ref_column: string; // Backend uses 'ref_column' not 'referenced_column'
}

interface Index {
  name: string;
  column_names: string[];
  unique?: boolean;
}

interface TableSchema {
  name: string;
  columns: Column[];
  foreign_keys?: ForeignKey[];
  indexes?: Index[];
  row_count?: number;
}

interface SchemaDef {
  database_name?: string;
  db_type?: string;
  tables: TableSchema[];
}

interface SchemaViewerProps {
  schema: Record<string, any> | null | undefined;
  workspaceId?: string;
  onSync?: () => void;
}

export function SchemaViewer({ schema, workspaceId, onSync }: SchemaViewerProps) {
  const navigate = useNavigate();
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [isDiagramModalOpen, setIsDiagramModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Parse schema to SchemaDef format
  const schemaDef = schema as SchemaDef | null;

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

  const handleSync = async () => {
    if (!workspaceId) return;

    setIsSyncing(true);
    try {
      await workspaceService.syncSchema(workspaceId);
      onSync?.();
    } catch (error) {
      console.error('Failed to sync schema:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Empty state
  if (!schemaDef || !schemaDef.tables || schemaDef.tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className={cn(
          'w-16 h-16 rounded-full flex items-center justify-center mb-4',
          'bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark'
        )}>
          <Database className="w-8 h-8 text-text-muted-DEFAULT dark:text-text-muted-dark" />
        </div>
        <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-2">
          No Schema Available
        </h3>
        <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark max-w-sm">
          Schema metadata has not been loaded yet. For real databases, sync to fetch schema. For simulations, define your schema.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col transition-all duration-500 ease-in-out">
      {/* Header */}
      <div className="flex-shrink-0 bg-surface dark:bg-background-dark border-b border-border-DEFAULT dark:border-border-dark p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary dark:text-primary-dark" />
            <h2 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark">
              Database Schema
            </h2>
          </div>
        </div>

        {schemaDef.database_name && (
          <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark mb-2">
            {schemaDef.database_name} ({schemaDef.db_type})
          </p>
        )}
        <div className="flex items-center justify-between">
          <p className="text-s text-text-muted-DEFAULT dark:text-text-muted-dark">
            {schemaDef.tables.length} {schemaDef.tables.length === 1 ? 'table' : 'tables'}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={cn(
                'group flex items-center gap-0 px-1 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ease-in-out',
                'group-hover:px-2',
                'bg-primary dark:bg-primary-dark hover:bg-primary-hover dark:hover:bg-primary-dark-hover text-white font-medium',
                'text-white transition-all hover:shadow-lg hover:shadow-primary/20 dark:hover:shadow-primary-dark/20'
              )}
            >
              <RefreshCw className={cn('w-6 h-6', isSyncing && 'animate-spin')} />
              <span className="max-w-0 overflow-hidden group-hover:max-w-24 group-hover:overflow-visible transition-all duration-300 ease-in-out whitespace-nowrap ml-0 group-hover:ml-2">
                Sync Schema
              </span>
            </button>
            
            {workspaceId && (
              <button
                onClick={() => navigate(`/schema-editor/${workspaceId}`)}
                className={cn(
                  'group flex items-center gap-0 px-1 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ease-in-out',
                  'group-hover:px-2',
                  'bg-primary dark:bg-primary-dark hover:bg-primary-hover dark:hover:bg-primary-dark-hover text-white font-medium',
                'text-white transition-all hover:shadow-lg hover:shadow-primary/20 dark:hover:shadow-primary-dark/20'
                )}
              >
                <Edit className="w-6 h-6" />
                <span className="max-w-0 overflow-hidden group-hover:max-w-24 group-hover:overflow-visible transition-all duration-300 ease-in-out whitespace-nowrap ml-0 group-hover:ml-2">
                  Edit Schema
                </span>
              </button>
            )}
            
            <button
              onClick={() => setIsDiagramModalOpen(true)}
              className={cn(
                'group flex items-center gap-0 px-1 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ease-in-out',
                'group-hover:px-2',
                'bg-primary dark:bg-primary-dark hover:bg-primary-hover dark:hover:bg-primary-dark-hover text-white font-medium',
                'text-white transition-all hover:shadow-lg hover:shadow-primary/20 dark:hover:shadow-primary-dark/20'
              )}
            >
              <Network className="w-6 h-6" />
              <span className="max-w-0 overflow-hidden group-hover:max-w-24 group-hover:overflow-visible transition-all duration-300 ease-in-out whitespace-nowrap ml-0 group-hover:ml-2">
                View Diagram
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto p-2">
        {schemaDef.tables.map((table) => {
          const isExpanded = expandedTables.has(table.name);
          
          return (
            <div
              key={table.name}
              className={cn(
                'mb-2 rounded-lg border transition-all duration-500 ease-in-out',
                'border-border-DEFAULT dark:border-border-dark',
                'bg-surface dark:bg-background-dark'
              )}
            >
              {/* Table Header */}
              <button
                onClick={() => toggleTable(table.name)}
                className={cn(
                  'w-full flex items-center gap-2 p-3 text-left',
                  'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark',
                  'transition-colors rounded-lg'
                )}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-text-muted-DEFAULT dark:text-text-muted-dark flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-text-muted-DEFAULT dark:text-text-muted-dark flex-shrink-0" />
                )}
                <Table className="w-4 h-4 text-primary dark:text-primary-dark flex-shrink-0" />
                <span className="font-medium text-text-main-DEFAULT dark:text-text-main-dark">
                  {table.name}
                </span>
                <div className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark ml-auto text-right">
                  <div>{table.columns.length} cols</div>
                  <div>
                    {table.row_count !== undefined && table.row_count !== null 
                      ? `${table.row_count.toLocaleString()} rows`
                      : '- rows'
                    }
                  </div>
                </div>
              </button>

              {/* Table Columns (Expanded) */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-1 transition-all duration-500 ease-in-out">
                  {table.columns.map((column) => (
                    <div
                      key={column.name}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded transition-all duration-400',
                        'bg-surface-light dark:bg-surface-dark',
                        'text-sm'
                      )}
                    >
                      {/* Primary Key Icon */}
                      {column.is_pk && (
                        <Key className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                      )}
                      
                      {/* Foreign Key Icon */}
                      {table.foreign_keys?.some(fk => fk.column === column.name) && (
                        <Link className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      )}
                      
                      {/* Column Name */}
                      <span className={cn(
                        'font-mono text-text-main-DEFAULT dark:text-text-main-dark',
                        column.is_pk && 'font-semibold'
                      )}>
                        {column.name}
                      </span>
                      
                      {/* Data Type */}
                      <span className="text-text-muted-DEFAULT dark:text-text-muted-dark">
                        {column.type}
                      </span>
                      
                      {/* Nullable Badge */}
                      {column.is_nullable === false && (
                        <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                          NOT NULL
                        </span>
                      )}
                    </div>
                  ))}

                  {/* Foreign Keys Section */}
                  {table.foreign_keys && table.foreign_keys.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-border-DEFAULT dark:border-border-dark transition-all duration-400">
                      <p className="text-xs font-semibold text-text-muted-DEFAULT dark:text-text-muted-dark mb-2">
                        Foreign Keys
                      </p>
                      {table.foreign_keys.map((fk, idx) => (
                        <div
                          key={idx}
                          className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark flex items-center gap-1 mb-1 transition-all duration-400"
                        >
                          <Link className="w-3 h-3" />
                          <span className="font-mono">{fk.column}</span>
                          <span>→</span>
                          <span className="font-mono">{fk.ref_table}.{fk.ref_column}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Indexes Section */}
                  {table.indexes && table.indexes.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-border-DEFAULT dark:border-border-dark transition-all duration-400">
                      <p className="text-xs font-semibold text-text-muted-DEFAULT dark:text-text-muted-dark mb-2">
                        Indexes
                      </p>
                      {table.indexes.map((index, idx) => (
                        <div
                          key={idx}
                          className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark flex items-center gap-1 mb-1 transition-all duration-400"
                        >
                          <Key className="w-3 h-3" />
                          <span className="font-mono">{index.name}</span>
                          {index.unique && (
                            <span className="text-xs px-1 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                              UNIQUE
                            </span>
                          )}
                          <span className="ml-2">({index.column_names.join(', ')})</span>
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

      {/* Diagram Modal */}
      <SchemaDiagramModal
        isOpen={isDiagramModalOpen}
        onClose={() => setIsDiagramModalOpen(false)}
        schema={schemaDef}
      />
    </div>
  );
}
