/**
 * SimulationDesigner Page
 * No-code database schema designer for simulation workspaces
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useWorkspace } from '../hooks/useWorkspace';
import { SimulationSchema, SimulationTable, BackendTable } from '../types/simulation';
import { workspaceService } from '../services/workspaceService';
import { DbType } from '../types/workspace';
import { TablesSidebar, StructureEditor, SampleDataEditor } from '../components/simulation';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';

type TabType = 'structure' | 'data';

export function SimulationDesigner() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { workspace, isLoading, isError } = useWorkspace(workspaceId!);
  
  const [schema, setSchema] = useState<SimulationSchema>({
    is_simulation: true,
    tables: [],
  });
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('structure');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load schema from workspace metadata (only once when workspace loads)
  useEffect(() => {
    if (!workspace) return;

    // Redirect if not a simulation workspace
    if (workspace.db_type !== DbType.SIMULATION) {
      navigate(`/editor/${workspaceId}`, { replace: true });
      return;
    }

    // Initialize schema from meta_schema or use empty default
    const loadedSchema: SimulationSchema = workspace.meta_schema && 
      typeof workspace.meta_schema === 'object' && 
      'tables' in workspace.meta_schema
        ? (workspace.meta_schema as SimulationSchema)
        : { is_simulation: true, tables: [] };
    
    console.log('Raw schema from backend:', loadedSchema);
    
    // CRITICAL FIX: Backend doesn't provide IDs for tables/columns, generate them
    // Also restore FK relationships from foreign_keys array to column.fk_target
    
    // Step 1: Cast to backend format and generate IDs for all tables and columns first
    const backendTables = (loadedSchema.tables || []) as BackendTable[];
    const tableIdMap = new Map<string, string>(); // tableName -> tableId
    const columnIdMap = new Map<string, Map<string, string>>(); // tableName -> (columnName -> columnId)
    
    // First pass: Generate all IDs and build lookup maps
    const tablesWithIds = backendTables.map(table => {
      const tableId = table.id || uuidv4();
      tableIdMap.set(table.name, tableId);
      
      const colMap = new Map<string, string>();
      const columns = table.columns.map(col => {
        const colId = col.id || uuidv4();
        colMap.set(col.name, colId);
        return {
          id: colId,
          name: col.name,
          type: col.type,
          is_pk: col.is_pk,
          is_nullable: col.is_nullable,
          default: col.default,
        };
      });
      
      columnIdMap.set(table.name, colMap);
      
      return {
        id: tableId,
        name: table.name,
        columns,
        foreign_keys: table.foreign_keys || [],
        sample_data: table.sample_data || []
      };
    });
    
    console.log('Generated table IDs:', Object.fromEntries(tableIdMap));
    console.log('Generated column IDs:', Object.fromEntries(
      Array.from(columnIdMap.entries()).map(([table, cols]) => [
        table,
        Object.fromEntries(cols)
      ])
    ));
    
    // Second pass: Restore FK relationships using the ID maps
    const schemaWithIds: SimulationSchema = {
      ...loadedSchema,
      tables: tablesWithIds.map(table => {
        const columnsWithFKs = table.columns.map(col => {
          // Find FK definition for this column
          const fkDef = table.foreign_keys.find(fk => fk.column === col.name);
          
          if (fkDef) {
            const refTableId = tableIdMap.get(fkDef.ref_table);
            const refColId = columnIdMap.get(fkDef.ref_table)?.get(fkDef.ref_column);
            
            console.log(`FK for ${table.name}.${col.name} -> ${fkDef.ref_table}.${fkDef.ref_column}`);
            console.log(`  Resolved IDs: table=${refTableId}, column=${refColId}`);
            
            if (refTableId && refColId) {
              return {
                ...col,
                fk_target: {
                  table_id: refTableId,
                  column_id: refColId
                }
              };
            }
          }
          
          return col;
        });
        
        return {
          id: table.id,
          name: table.name,
          columns: columnsWithFKs,
          sample_data: table.sample_data
        };
      })
    };
    
    console.log('Schema with generated IDs:', schemaWithIds);
    console.log('Table count:', schemaWithIds.tables.length);
    console.log('Table IDs:', schemaWithIds.tables.map(t => t.id));
    
    setSchema(schemaWithIds);
    
    // Select first table if available and no table is currently selected
    if (schemaWithIds.tables && schemaWithIds.tables.length > 0 && !selectedTableId) {
      console.log('Auto-selecting first table:', schemaWithIds.tables[0].id);
      setSelectedTableId(schemaWithIds.tables[0].id);
    }
  }, [workspace, workspaceId, navigate]); // Removed selectedTableId from dependencies

  // Get selected table
  const selectedTable = schema.tables.find(t => t.id === selectedTableId);

  const handleSaveChanges = async () => {
    if (!workspaceId) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      console.log('Saving schema:', schema);
      console.log('Number of tables:', schema.tables.length);
      console.log('Table names:', schema.tables.map(t => t.name));
      console.log('Table IDs:', schema.tables.map(t => t.id));
      
      // Transform schema to backend format
      const payload = {
        tables: schema.tables.map(table => ({
          name: table.name,
          columns: table.columns.map(col => ({
            name: col.name,
            type: col.type,
            is_pk: col.is_pk,
            is_nullable: col.is_nullable,
            default: col.default,
          })),
          foreign_keys: table.columns
            .filter(col => col.fk_target)
            .map(col => {
              const refTable = schema.tables.find(t => t.id === col.fk_target!.table_id);
              const refColumn = refTable?.columns.find(c => c.id === col.fk_target!.column_id);
              return {
                column: col.name,
                ref_table: refTable!.name,
                ref_column: refColumn!.name,
              };
            }),
          indexes: [],
          sample_data: table.sample_data,
        })),
      };

      await workspaceService.updateSimulationSchema(workspaceId, payload);
      
      // Show success feedback
      console.log('Schema saved successfully');
      toast.success('Schema saved successfully!', {
        position: 'top-right',
        autoClose: 3000,
      });
    } catch (error) {
      console.error('Failed to save schema:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save schema';
      setSaveError(errorMessage);
      toast.error(`Failed to save schema: ${errorMessage}`, {
        position: 'top-right',
        autoClose: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary dark:text-primary-dark" />
      </div>
    );
  }

  if (isError || !workspace) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-2">
            Failed to Load Workspace
          </h2>
          <button
            onClick={() => navigate('/workspaces')}
            className="px-4 py-2 bg-primary dark:bg-primary-dark text-white rounded-lg"
          >
            Back to Workspaces
          </button>
        </div>
      </div>
    );
  }

  // Show loading while redirecting non-simulation workspaces
  if (workspace.db_type !== DbType.SIMULATION) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary dark:text-primary-dark" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className={cn(
        'flex items-center justify-between px-6 py-4 flex-shrink-0',
        'bg-surface-DEFAULT dark:bg-surface-dark',
        'border-b border-border-DEFAULT dark:border-border-dark'
      )}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/workspaces')}
            className={cn(
              'p-2 rounded-lg transition-colors',
              'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark'
            )}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
              {workspace.name}
            </h1>
            <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
              Simulation Workspace - Schema Designer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveError && (
            <p className="text-sm text-red-500">{saveError}</p>
          )}
          <button
            onClick={handleSaveChanges}
            disabled={isSaving}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white',
              'bg-primary dark:bg-primary-dark',
              'hover:bg-primary-hover dark:hover:bg-primary-dark-hover',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors'
            )}
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Tables List */}
        <TablesSidebar
          schema={schema}
          selectedTableId={selectedTableId}
          onSelectTable={(tableId) => {
            console.log('Selecting table:', tableId);
            setSelectedTableId(tableId);
          }}
          onUpdateSchema={(updatedSchema) => {
            console.log('Updating schema from sidebar:', updatedSchema);
            setSchema(updatedSchema);
          }}
        />

        {/* Right Panel - Table Editor */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedTable ? (
            <>
              {/* Tabs */}
              <div className={cn(
                'flex items-center gap-1 px-6 py-3 border-b',
                'bg-surface-DEFAULT dark:bg-surface-dark',
                'border-border-DEFAULT dark:border-border-dark'
              )}>
                <button
                  onClick={() => setActiveTab('structure')}
                  className={cn(
                    'px-4 py-2 rounded-lg font-medium transition-all',
                    activeTab === 'structure'
                      ? 'bg-primary dark:bg-primary-dark text-white'
                      : 'text-text-muted-DEFAULT dark:text-text-muted-dark hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark'
                  )}
                >
                  Structure
                </button>
                <button
                  onClick={() => setActiveTab('data')}
                  className={cn(
                    'px-4 py-2 rounded-lg font-medium transition-all',
                    activeTab === 'data'
                      ? 'bg-primary dark:bg-primary-dark text-white'
                      : 'text-text-muted-DEFAULT dark:text-text-muted-dark hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark'
                  )}
                >
                  Sample Data
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-auto">
                {activeTab === 'structure' ? (
                  <StructureEditor
                    key={selectedTable.id}
                    table={selectedTable}
                    schema={schema}
                    onUpdateTable={(updatedTable: SimulationTable) => {
                      setSchema(prev => ({
                        ...prev,
                        tables: prev.tables.map(t =>
                          t.id === updatedTable.id ? updatedTable : t
                        ),
                      }));
                    }}
                  />
                ) : (
                  <SampleDataEditor
                    key={selectedTable.id}
                    table={selectedTable}
                    onUpdateTable={(updatedTable: SimulationTable) => {
                      setSchema(prev => ({
                        ...prev,
                        tables: prev.tables.map(t =>
                          t.id === updatedTable.id ? updatedTable : t
                        ),
                      }));
                    }}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-text-muted-DEFAULT dark:text-text-muted-dark">
                <p className="text-lg mb-2">No table selected</p>
                <p className="text-sm">Create or select a table to get started</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
