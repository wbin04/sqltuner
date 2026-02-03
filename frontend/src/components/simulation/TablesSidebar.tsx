/**
 * TablesSidebar Component
 * Left sidebar showing list of tables in simulation schema
 */
import { Plus, Table, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SimulationSchema, SimulationTable, ColumnType } from '../../types/simulation';
import { v4 as uuidv4 } from 'uuid';

interface TablesSidebarProps {
  schema: SimulationSchema;
  selectedTableId: string | null;
  isReadOnly?: boolean;
  onSelectTable: (tableId: string) => void;
  onUpdateSchema: (schema: SimulationSchema) => void;
}

export function TablesSidebar({
  schema,
  selectedTableId,
  isReadOnly = false,
  onSelectTable,
  onUpdateSchema,
}: TablesSidebarProps) {
  
  console.log('TablesSidebar render:', {
    tableCount: schema.tables.length,
    tableNames: schema.tables.map(t => t.name),
    tableIds: schema.tables.map(t => t.id),
    selectedTableId
  });
  
  const handleCreateTable = () => {
    const newTable: SimulationTable = {
      id: uuidv4(),
      name: `table_${schema.tables.length + 1}`,
      columns: [
        {
          id: uuidv4(),
          name: 'id',
          type: ColumnType.UUID,
          is_pk: true,
          is_nullable: false,
          fk_target: null,
        },
      ],
      sample_data: [],
    };

    const updatedSchema = {
      ...schema,
      tables: [...schema.tables, newTable],
    };

    onUpdateSchema(updatedSchema);
    onSelectTable(newTable.id);
  };

  const handleDeleteTable = (tableId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this table?')) return;

    const updatedSchema = {
      ...schema,
      tables: schema.tables.filter(t => t.id !== tableId),
    };

    onUpdateSchema(updatedSchema);

    if (selectedTableId === tableId) {
      const nextTableId = updatedSchema.tables[0]?.id;
      if (nextTableId) {
        onSelectTable(nextTableId);
      }
    }
  };

  return (
    <aside className={cn(
      'w-72 flex-shrink-0 flex flex-col',
      'bg-surface-DEFAULT dark:bg-surface-dark',
      'border-r border-border-DEFAULT dark:border-border-dark'
    )}>
      {/* Header */}
      <div className="p-4 border-b border-border-DEFAULT dark:border-border-dark">
        <h2 className="text-sm font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-3">
          TABLES
        </h2>
        <button
          onClick={handleCreateTable}
          disabled={isReadOnly}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg',
            'bg-primary dark:bg-primary-dark text-white',
            'hover:bg-primary-hover dark:hover:bg-primary-dark-hover',
            'transition-colors font-medium',
            'disabled:hidden disabled:cursor-not-allowed'
          )}
        >
          <Plus className="w-4 h-4" />
          New Table
        </button>
      </div>

      {/* Tables List */}
      <div className="flex-1 overflow-y-auto p-2">
        {schema.tables.length === 0 ? (
          <div className="p-4 text-center text-text-muted-DEFAULT dark:text-text-muted-dark text-sm">
            No tables yet. Click "New Table" to create one.
          </div>
        ) : (
          <div className="space-y-1">
            {schema.tables.map((table) => (
              <div
                key={table.id}
                onClick={() => onSelectTable(table.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectTable(table.id);
                  }
                }}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg',
                  'text-left transition-colors group cursor-pointer',
                  selectedTableId === table.id
                    ? 'bg-primary/10 dark:bg-primary-dark/10 text-primary dark:text-primary-dark'
                    : 'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark text-text-main-DEFAULT dark:text-text-main-dark'
                )}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Table className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium truncate">{table.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
                    {table.columns.length} cols
                  </span>
                  <button
                    onClick={(e) => handleDeleteTable(table.id, e)}
                    disabled={isReadOnly}
                    className={cn(
                      'p-1 rounded hover:bg-red-500/10 text-red-500',
                      'opacity-0 group-hover:opacity-100 transition-opacity',
                      'disabled:hidden disabled:cursor-not-allowed'
                    )}
                    aria-label="Delete table"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
