/**
 * SchemaEditor Page
 * Edit database schema for both real databases and simulations
 * Similar to SimulationDesigner but works with any workspace type
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, AlertCircle, Network } from 'lucide-react';
import { cn } from '../lib/utils';
import { useWorkspace } from '../hooks/useWorkspace';
import { SimulationSchema, SimulationTable, BackendTable } from '../types/simulation';
import { workspaceService } from '../services/workspaceService';
import { DbType } from '../types/workspace';
import { TablesSidebar, StructureEditor, SampleDataEditor } from '../components/simulation';
import { SchemaDiagramModal } from '../components/editor/diagram/SchemaDiagramModal';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';

type TabType = 'structure' | 'data';

export function SchemaEditor() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { workspace, isLoading, isError } = useWorkspace(workspaceId!);
  
  const [schema, setSchema] = useState<SimulationSchema>({
    is_simulation: true,
    tables: [],
  });
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('structure');
  const [isDiagramModalOpen, setIsDiagramModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Load schema from workspace metadata
  useEffect(() => {
    if (!workspace) return;

    const loadedSchema = workspace.meta_schema && 
      typeof workspace.meta_schema === 'object' && 
      'tables' in workspace.meta_schema
        ? (workspace.meta_schema as any)
        : { tables: [] };
    
    console.log('Raw schema from backend:', loadedSchema);
    
    // Generate IDs for all tables and columns, restore FK relationships
    const backendTables = (loadedSchema.tables || []) as BackendTable[];
    const tableIdMap = new Map<string, string>();
    const columnIdMap = new Map<string, Map<string, string>>();
    
    // First pass: Generate all IDs
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
      
      // Process indexes: convert column names to column IDs
      const indexes = (table.indexes || []).map(idx => ({
        id: idx.id || uuidv4(),
        name: idx.name,
        columns: (idx.column_names || [])
          .map(colName => colMap.get(colName))
          .filter((id): id is string => !!id),
        unique: idx.unique || false,
      }));
      
      return {
        id: tableId,
        name: table.name,
        columns,
        indexes,
        foreign_keys: table.foreign_keys || [],
        sample_data: table.sample_data || []
      };
    });
    
    // Second pass: Restore FK relationships
    const schemaWithIds: SimulationSchema = {
      is_simulation: true,
      tables: tablesWithIds.map(table => {
        const columnsWithFKs = table.columns.map(col => {
          const fkDef = table.foreign_keys.find(fk => fk.column === col.name);
          
          if (fkDef) {
            const refTableId = tableIdMap.get(fkDef.ref_table);
            const refColId = columnIdMap.get(fkDef.ref_table)?.get(fkDef.ref_column);
            
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
          indexes: table.indexes,
          sample_data: table.sample_data
        };
      })
    };
    
    console.log('Schema with generated IDs:', schemaWithIds);
    setSchema(schemaWithIds);
    
    // Select first table if available
    if (schemaWithIds.tables && schemaWithIds.tables.length > 0 && !selectedTableId) {
      setSelectedTableId(schemaWithIds.tables[0].id);
    }
  }, [workspace, workspaceId, navigate]);

  // Load table data when selecting a table (for real databases)
  useEffect(() => {
    async function loadTableData() {
      if (!workspace || !selectedTableId) return;
      
      const selectedTable = schema.tables.find(t => t.id === selectedTableId);
      if (!selectedTable) return;

      // If already has data or is simulation, skip
      if (selectedTable.sample_data.length > 0 || workspace.db_type === DbType.SIMULATION) {
        return;
      }

      try {
        setIsLoadingData(true);
        const tableData = await workspaceService.getTableData(
          workspaceId!,
          selectedTable.name,
          100 // RESULT_MAX_ROWS
        );

        // Update table with fetched data
        setSchema(prev => ({
          ...prev,
          tables: prev.tables.map(t =>
            t.id === selectedTableId
              ? { ...t, sample_data: tableData.rows }
              : t
          ),
        }));
      } catch (error) {
        console.error('Failed to load table data:', error);
        if ((error as any).response?.status !== 404) {
          toast.error(`Failed to load data for ${selectedTable.name}`);
        }
        // For 404 (no data) or other errors, treat as empty array
        setSchema(prev => ({
          ...prev,
          tables: prev.tables.map(t =>
            t.id === selectedTableId
              ? { ...t, sample_data: [] }
              : t
          ),
        }));
      } finally {
        setIsLoadingData(false);
      }
    }

    loadTableData();
  }, [selectedTableId, workspace, workspaceId]);

  const selectedTable = schema.tables.find(t => t.id === selectedTableId);
  const isReadOnly = workspace?.db_type !== DbType.SIMULATION;

  // Memoize diagram schema to ensure new object on every schema change
  const diagramSchema = useMemo(() => {
    if (!workspace || !schema.tables.length) return null;
    
    return {
      database_name: workspace.name,
      db_type: workspace.db_type || 'simulation',
      tables: schema.tables.map(table => ({
        name: table.name,
        columns: table.columns.map(col => ({
          name: col.name,
          type: col.type,
          is_nullable: col.is_nullable,
          is_pk: col.is_pk
        })),
        foreign_keys: table.columns
          .filter(col => col.fk_target)
          .map(col => {
            const refTable = schema.tables.find(t => t.id === col.fk_target!.table_id);
            const refCol = refTable?.columns.find(c => c.id === col.fk_target!.column_id);
            return {
              column: col.name,
              ref_table: refTable!.name,
              ref_column: refCol!.name
            };
          }),
        row_count: table.sample_data?.length || 0
      }))
    };
  }, [workspace, schema]);

  const handleSaveChanges = async (schemaToSave?: SimulationSchema) => {
    if (!workspaceId) return;

    if (workspace?.db_type !== DbType.SIMULATION) {
      toast.error('Schema editing is only available for simulation workspaces');
      return;
    }

    setIsSaving(true);

    const currentSchema = schemaToSave || schema;

    try {
      // Transform schema to backend format
      const payload = {
        tables: currentSchema.tables.map(table => ({
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
              const refTable = currentSchema.tables.find(t => t.id === col.fk_target!.table_id);
              const refColumn = refTable?.columns.find(c => c.id === col.fk_target!.column_id);
              return {
                column: col.name,
                ref_table: refTable!.name,
                ref_column: refColumn!.name,
              };
            }),
          indexes: (table.indexes || []).map(idx => ({
            name: idx.name,
            column_names: idx.columns
              .map(colId => table.columns.find(c => c.id === colId)?.name)
              .filter((name): name is string => !!name),
            unique: idx.unique,
          })),
          sample_data: table.sample_data,
          row_count: table.sample_data.length,
        })),
      };

      await workspaceService.updateSimulationSchema(workspaceId, payload);
      
      toast.success('Schema saved successfully!', {
        position: 'top-right',
        autoClose: 3000,
      });
    } catch (error) {
      console.error('Failed to save schema:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save schema';
      toast.error(`Failed to save schema: ${errorMessage}`, {
        position: 'top-right',
        autoClose: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTable = (tableName: string) => {
    const newTable: SimulationTable = {
      id: uuidv4(),
      name: tableName,
      columns: [],
      indexes: [],
      sample_data: [],
    };

    const newSchema = {
      ...schema,
      tables: [...schema.tables, newTable],
    };

    setSchema(newSchema);
    setSelectedTableId(newTable.id);
    toast.info(`Table "${tableName}" added. Add columns and save to persist.`);
  };

  const handleEditTable = (tableName: string) => {
    const table = schema.tables.find(t => t.name === tableName);
    if (table) {
      setSelectedTableId(table.id);
      setIsDiagramModalOpen(false);
      toast.info(`Editing table "${tableName}"`);
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

  return (
    <div className="h-screen flex flex-col bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className={cn(
        'flex items-center justify-between px-6 py-4 flex-shrink-0',
        'bg-surface-light dark:bg-surface-dark',
        'border-b border-border-DEFAULT dark:border-border-dark'
      )}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/editor/${workspaceId}`)}
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
              Schema Editor - {workspace.db_type}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDiagramModalOpen(true)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white',
              'bg-primary dark:bg-primary-dark',
              'hover:bg-primary-hover dark:hover:bg-primary-dark-hover',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors'
            )}
          >
            <Network className="w-5 h-5" />
            View Diagram
          </button>
          {workspace?.db_type === DbType.SIMULATION && (
            <button
              onClick={() => handleSaveChanges()}
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
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Tables List */}
        <TablesSidebar
          schema={schema}
          selectedTableId={selectedTableId}
          isReadOnly={isReadOnly}
          onSelectTable={(tableId) => {
            setSelectedTableId(tableId);
          }}
          onUpdateSchema={(updatedSchema) => {
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
                'bg-surface-light dark:bg-surface-dark',
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
                  Sample Data ({selectedTable.sample_data.length} rows)
                  {isLoadingData && <Loader2 className="inline w-3 h-3 ml-2 animate-spin" />}
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-auto">
                {activeTab === 'structure' ? (
                  <StructureEditor
                    key={selectedTable.id}
                    table={selectedTable}
                    schema={schema}
                    isReadOnly={isReadOnly}
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
                    isReadOnly={isReadOnly}
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
                <p className="text-sm">Select a table to edit its structure and data</p>
              </div>
            </div>
          )}
        </main>
      </div>

      
      {/* Diagram Modal */}
      <SchemaDiagramModal
        isOpen={isDiagramModalOpen}
        onClose={() => setIsDiagramModalOpen(false)}
        isSimulation={workspace?.db_type === DbType.SIMULATION}
        schema={diagramSchema}
        onAddTable={handleAddTable}
        onEditTable={handleEditTable}
        onSave={async (updatedSchema) => {
          // Transform back to internal schema format
          const tableNameToIdMap = new Map(schema.tables.map(t => [t.name, t.id]));
          
          // Process existing tables and new tables
          const processedTables: SimulationTable[] = [];
          
          for (const updatedTable of updatedSchema.tables) {
            const existingTable = schema.tables.find(t => t.name === updatedTable.name);
            
            if (existingTable) {
              // Update existing table
              const columnsWithFKs = existingTable.columns.map(col => {
                const fkDef = updatedTable.foreign_keys?.find(fk => fk.column === col.name);
                
                if (fkDef) {
                  const refTableId = tableNameToIdMap.get(fkDef.ref_table);
                  const refTable = schema.tables.find(t => t.id === refTableId);
                  const refColId = refTable?.columns.find(c => c.name === fkDef.ref_column)?.id;

                  if (refTableId && refColId) {
                    return {
                      ...col,
                      fk_target: { table_id: refTableId, column_id: refColId },
                    };
                  }
                }

                // Check if FK was removed
                if (col.fk_target && !updatedTable.foreign_keys?.some(fk => fk.column === col.name)) {
                  return { ...col, fk_target: null };
                }

                return col;
              });

              // Handle new columns added from diagram
              const newColumns = updatedTable.columns
                .filter(col => !existingTable.columns.some(c => c.name === col.name))
                .map(col => ({
                  id: uuidv4(),
                  name: col.name,
                  type: col.type,
                  is_pk: col.is_pk || false,
                  is_nullable: col.is_nullable !== false, // default true
                  fk_target: null,
                }));

              // Handle removed columns
              const remainingColumns = columnsWithFKs.filter(col => 
                updatedTable.columns.some(c => c.name === col.name)
              );

              processedTables.push({
                ...existingTable,
                columns: [...remainingColumns, ...newColumns],
              });
            } else {
              // New table created from diagram
              processedTables.push({
                id: uuidv4(),
                name: updatedTable.name,
                columns: updatedTable.columns.map(col => ({
                  id: uuidv4(),
                  name: col.name,
                  type: col.type,
                  is_pk: col.is_pk || false,
                  is_nullable: col.is_nullable !== false,
                  fk_target: null,
                })),
                indexes: (updatedTable as any).indexes || [],
                sample_data: (updatedTable as any).sample_data || [],
              });
            }
          }
          
          const newSchema: SimulationSchema = {
            ...schema,
            tables: processedTables,
          };

          // Save to backend first
          await handleSaveChanges(newSchema);

          // Only update state after successful save
          setSchema(newSchema);
        }}
      />
    </div>
  );
}
