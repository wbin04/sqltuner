/**
 * SchemaEditor Page
 * Edit database schema for both real databases and simulations
 * Similar to SimulationDesigner but works with any workspace type
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, AlertCircle, Network, Sparkles, Upload, Download } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useUnsavedChangesWarning } from '../../hooks/useUnsavedChangesWarning';
import { SimulationSchema, SimulationTable, BackendTable } from '../../types/simulation';
import { workspaceService } from '../../services/workspaceService';
import { DbType } from '../../types/workspace';
import { TablesSidebar, StructureEditor, SampleDataEditor } from '../../components/simulation';
import { GenerateSchemaModal, type GenerateResult } from '../../components/simulation/GenerateSchemaModal';
import { SchemaDiagramModal } from '../../components/diagram/SchemaDiagramModal';
import { UnsavedChangesModal } from '../../components/common/UnsavedChangesModal';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';

type TabType = 'structure' | 'data';

export function SchemaEditor() {
  const { workspaceId, conversationId } = useParams<{ workspaceId: string; conversationId?: string }>();
  const navigate = useNavigate();
  const { workspace, isLoading, isError } = useWorkspace(workspaceId!);

  const [schema, setSchema] = useState<SimulationSchema>({
    is_simulation: true,
    tables: [],
  });
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('structure');
  const [isDiagramModalOpen, setIsDiagramModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Store initial schema to compare for changes
  const initialSchemaRef = useRef<string>('');

  // Load schema from workspace metadata
  useEffect(() => {
    if (!workspace) return;

    const loadedSchema = workspace.meta_schema &&
      typeof workspace.meta_schema === 'object' &&
      'tables' in workspace.meta_schema
      ? (workspace.meta_schema as any)
      : { tables: [] };

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

    setSchema(schemaWithIds);

    // Store initial schema for comparison
    initialSchemaRef.current = JSON.stringify(schemaWithIds);
    setHasUnsavedChanges(false);

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

  // Track changes in schema
  useEffect(() => {
    if (!initialSchemaRef.current) return;

    const currentSchemaStr = JSON.stringify(schema);
    const hasChanges = currentSchemaStr !== initialSchemaRef.current;
    setHasUnsavedChanges(hasChanges);
  }, [schema]);

  // Warn before page reload/close - DISABLED to avoid native alert conflict with modal
  // useEffect(() => {
  //   const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  //     if (hasUnsavedChanges && workspace?.db_type === DbType.SIMULATION) {
  //       e.preventDefault();
  //       e.returnValue = '';
  //     }
  //   };

  //   window.addEventListener('beforeunload', handleBeforeUnload);
  //   return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  // }, [hasUnsavedChanges, workspace]);

  // Block navigation when there are unsaved changes
  const { allowNavigation } = useUnsavedChangesWarning({
    when: hasUnsavedChanges && workspace?.db_type === DbType.SIMULATION,
    onNavigate: () => {
      setShowUnsavedModal(true);
    },
  });

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

      // Update initial schema ref after successful save
      initialSchemaRef.current = JSON.stringify(currentSchema);
      setHasUnsavedChanges(false);

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
    setHasUnsavedChanges(true);
    toast.info(`Table "${tableName}" added. Add columns and save to persist.`);
  };

  const handleApplyGeneratedSchema = (result: GenerateResult) => {
    const backendTables = result.schema_def?.tables || [];
    const tableIdMap = new Map<string, string>();
    const columnIdMap = new Map<string, Map<string, string>>();

    const tablesWithIds = backendTables.map((table) => {
      const tableId = uuidv4();
      tableIdMap.set(table.name, tableId);

      const colMap = new Map<string, string>();
      const columns = table.columns.map((col) => {
        const colId = uuidv4();
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

      const indexes = (table.indexes || []).map((idx) => ({
        id: uuidv4(),
        name: idx.name,
        columns: (idx.column_names || [])
          .map((colName) => colMap.get(colName))
          .filter((id): id is string => !!id),
        unique: idx.unique || false,
      }));

      return {
        id: tableId,
        name: table.name,
        columns,
        indexes,
        foreign_keys: table.foreign_keys || [],
        sample_data: [],
      };
    });

    const newSchema: SimulationSchema = {
      is_simulation: true,
      tables: tablesWithIds.map((table) => ({
        ...table,
        columns: table.columns.map((col) => {
          const fkDef = table.foreign_keys.find((fk) => fk.column === col.name);
          if (fkDef) {
            const refTableId = tableIdMap.get(fkDef.ref_table);
            const refColId = columnIdMap.get(fkDef.ref_table)?.get(fkDef.ref_column);
            if (refTableId && refColId) {
              return { ...col, fk_target: { table_id: refTableId, column_id: refColId } };
            }
          }
          return col;
        }),
      })),
    };

    setSchema(newSchema);
    setHasUnsavedChanges(true);
    setIsGenerateModalOpen(false);

    if (newSchema.tables.length > 0) {
      setSelectedTableId(newSchema.tables[0].id);
    }
  };

  const handleEditTable = (tableName: string) => {
    const table = schema.tables.find(t => t.name === tableName);
    if (table) {
      setSelectedTableId(table.id);
      setIsDiagramModalOpen(false);
      toast.info(`Editing table "${tableName}"`);
    }
  };

  const handleExportSql = async () => {
    if (!workspaceId) return;
    setIsExporting(true);
    try {
      await workspaceService.exportSchemaAsSql(workspaceId);
      toast.success('Schema exported successfully!');
    } catch (err) {
      toast.error('Failed to export schema. Ensure schema has been saved first.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImportFile(file);
    setShowImportConfirm(true);
    // Reset input để có thể chọn cùng file lần sau
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!workspaceId || !pendingImportFile) return;
    setShowImportConfirm(false);
    setIsImporting(true);
    try {
      const result = await workspaceService.importSchemaFromSql(workspaceId, pendingImportFile);
      toast.success(result.message);
      // Reload workspace để cập nhật schema mới
      window.location.reload();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to import file.';
      toast.error(detail);
    } finally {
      setIsImporting(false);
      setPendingImportFile(null);
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
            onClick={() => navigate(conversationId ? `/editor/${workspaceId}/${conversationId}` : `/editor/${workspaceId}`)}
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
          {/* Export SQL */}
          <button
            onClick={handleExportSql}
            disabled={isExporting}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              'border border-border-DEFAULT dark:border-border-dark',
              'text-text-main-DEFAULT dark:text-text-main-dark',
              'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            title="Export schema and data as .sql file"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export SQL
          </button>

          {/* Import SQL */}
          {workspace?.db_type === DbType.SIMULATION && (
            <>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".sql,.sqlite,.db"
                className="hidden"
                onChange={handleImportFileSelected}
              />
              <button
                onClick={() => importFileInputRef.current?.click()}
                disabled={isImporting}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  'border border-border-DEFAULT dark:border-border-dark',
                  'text-text-main-DEFAULT dark:text-text-main-dark',
                  'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
                title="Import .sql or .sqlite file (will overwrite current schema)"
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Import File
              </button>
            </>
          )}

          {workspace?.db_type === DbType.SIMULATION && (
            <button
              onClick={() => setIsGenerateModalOpen(true)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white',
                'bg-blue-600 hover:bg-blue-700 transition-colors'
              )}
            >
              <Sparkles className="w-4 h-4" />
              Generate with AI
            </button>
          )}
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
              disabled={isSaving || !hasUnsavedChanges}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white relative',
                'bg-primary dark:bg-primary-dark',
                'hover:bg-primary-hover dark:hover:bg-primary-dark-hover',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors'
              )}
            >
              {hasUnsavedChanges && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-900" />
              )}
              {isSaving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes *' : 'Saved'}
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
                    onUpdateSchema={(updatedSchema: SimulationSchema) => {
                      setSchema(updatedSchema);
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


      <GenerateSchemaModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onApply={handleApplyGeneratedSchema}
      />

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
          // First pass: Create table ID map including both existing and new tables
          const tableNameToIdMap = new Map<string, string>();
          const tableIdToColumnsMap = new Map<string, Map<string, string>>();

          // Map existing tables
          schema.tables.forEach(t => {
            tableNameToIdMap.set(t.name, t.id);
            const colMap = new Map(t.columns.map(c => [c.name, c.id]));
            tableIdToColumnsMap.set(t.id, colMap);
          });

          // Generate IDs for new tables
          updatedSchema.tables.forEach(t => {
            if (!tableNameToIdMap.has(t.name)) {
              const newTableId = uuidv4();
              tableNameToIdMap.set(t.name, newTableId);
              // For new tables, we'll populate column IDs in the second pass
              tableIdToColumnsMap.set(newTableId, new Map());
            }
          });

          // Process existing tables and new tables
          const processedTables: SimulationTable[] = [];

          for (const updatedTable of updatedSchema.tables) {
            const existingTable = schema.tables.find(t => t.name === updatedTable.name);
            const tableId = tableNameToIdMap.get(updatedTable.name)!;
            const columnIdMap = tableIdToColumnsMap.get(tableId)!;

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
                .map(col => {
                  const colId = uuidv4();
                  columnIdMap.set(col.name, colId);

                  // Check if this new column has a foreign key
                  const fkDef = updatedTable.foreign_keys?.find(fk => fk.column === col.name);
                  let fk_target = null;

                  if (fkDef) {
                    const refTableId = tableNameToIdMap.get(fkDef.ref_table);
                    let refColId: string | undefined;

                    // Try to get ref column ID from existing table
                    const refTable = schema.tables.find(t => t.id === refTableId);
                    if (refTable) {
                      refColId = refTable.columns.find(c => c.name === fkDef.ref_column)?.id;
                    }

                    // If ref table is also new, we need to get the column ID from the updated schema
                    if (!refColId && refTableId) {
                      const refUpdatedTable = updatedSchema.tables.find(t => t.name === fkDef.ref_table);
                      if (refUpdatedTable) {
                        // We'll need to generate the ID for the ref column if it doesn't exist yet
                        const refTableColMap = tableIdToColumnsMap.get(refTableId);
                        if (refTableColMap) {
                          refColId = refTableColMap.get(fkDef.ref_column);
                          if (!refColId) {
                            // Generate ID for the referenced column
                            refColId = uuidv4();
                            refTableColMap.set(fkDef.ref_column, refColId);
                          }
                        }
                      }
                    }

                    if (refTableId && refColId) {
                      fk_target = { table_id: refTableId, column_id: refColId };
                    }
                  }

                  return {
                    id: colId,
                    name: col.name,
                    type: col.type,
                    is_pk: col.is_pk || false,
                    is_nullable: col.is_nullable !== false,
                    fk_target,
                  };
                });

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
              const newTableColumns = updatedTable.columns.map(col => {
                const colId = uuidv4();
                columnIdMap.set(col.name, colId);

                // Check if this column has a foreign key
                const fkDef = updatedTable.foreign_keys?.find(fk => fk.column === col.name);
                let fk_target = null;

                if (fkDef) {
                  const refTableId = tableNameToIdMap.get(fkDef.ref_table);
                  let refColId: string | undefined;

                  // Try to get ref column ID from existing table
                  const refTable = schema.tables.find(t => t.id === refTableId);
                  if (refTable) {
                    refColId = refTable.columns.find(c => c.name === fkDef.ref_column)?.id;
                  }

                  // If ref table is also new, get/generate the column ID
                  if (!refColId && refTableId) {
                    const refTableColMap = tableIdToColumnsMap.get(refTableId);
                    if (refTableColMap) {
                      refColId = refTableColMap.get(fkDef.ref_column);
                      if (!refColId) {
                        // Generate ID for the referenced column
                        refColId = uuidv4();
                        refTableColMap.set(fkDef.ref_column, refColId);
                      }
                    }
                  }

                  if (refTableId && refColId) {
                    fk_target = { table_id: refTableId, column_id: refColId };
                  }
                }

                return {
                  id: colId,
                  name: col.name,
                  type: col.type,
                  is_pk: col.is_pk || false,
                  is_nullable: col.is_nullable !== false,
                  fk_target,
                };
              });

              processedTables.push({
                id: tableId,
                name: updatedTable.name,
                columns: newTableColumns,
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

      {/* Unsaved Changes Modal */}
      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        isSaving={isSaving}
        onSave={async () => {
          await handleSaveChanges();
          setShowUnsavedModal(false);
          allowNavigation();
        }}
        onDiscard={() => {
          setShowUnsavedModal(false);
          setHasUnsavedChanges(false);
          // Reset to initial schema
          initialSchemaRef.current = JSON.stringify(schema);
          allowNavigation();
        }}
        onCancel={() => {
          setShowUnsavedModal(false);
        }}
      />

      {/* Import Confirm Dialog */}
      {showImportConfirm && pendingImportFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold text-text-main-DEFAULT dark:text-text-main-dark">
                  Import File — Overwrite Warning
                </h3>
                <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">
                  Importing <span className="font-medium">"{pendingImportFile.name}"</span> will
                  <strong> replace all current tables and data</strong> in this sandbox.
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowImportConfirm(false);
                  setPendingImportFile(null);
                }}
                className="px-4 py-2 text-sm text-text-muted-DEFAULT dark:text-text-muted-dark hover:text-text-main-DEFAULT transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Yes, overwrite and import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
