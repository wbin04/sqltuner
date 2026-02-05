/**
 * SchemaDiagramModal Component
 * Full-screen modal overlay for displaying the schema diagram
 */
import { useState, useEffect, useRef } from 'react';
import { X, Save, Edit, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SchemaDiagram } from './SchemaDiagram';
import { UnsavedChangesModal } from '../common/UnsavedChangesModal';
import { toast } from 'react-toastify';

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

interface TableSchema {
  name: string;
  columns: Column[];
  foreign_keys?: ForeignKey[];
  indexes?: any[];
  row_count?: number;
}

interface SchemaDef {
  database_name?: string;
  db_type?: string;
  tables: TableSchema[];
}

interface SchemaDiagramModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema: SchemaDef | null;
  isSimulation?: boolean;
  onSave?: (updatedSchema: SchemaDef) => Promise<void>;
  onAddTable?: (tableName: string, position: { x: number; y: number }) => void;
  onEditTable?: (tableName: string) => void;
}

export function SchemaDiagramModal({ isOpen, onClose, schema, isSimulation = false, onSave, onAddTable, onEditTable }: SchemaDiagramModalProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedSchema, setEditedSchema] = useState<SchemaDef | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [diagramKey, setDiagramKey] = useState(0);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  
  // Store initial schema for comparison
  const initialSchemaRef = useRef<string>('');
  // Track what action triggered the unsaved modal (for proper Discard behavior)
  const closeActionRef = useRef<'close' | 'cancel'>('close');

  // Initialize edited schema when modal opens and reset when closes
  useEffect(() => {
    console.log('[SchemaDiagramModal.useEffect] isOpen:', isOpen, 'schema:', schema);
    
    if (isOpen) {
      // Initialize editedSchema even if schema is null - create empty schema
      const schemaToClone = schema || { tables: [] };
      const clonedSchema = JSON.parse(JSON.stringify(schemaToClone));
      console.log('[SchemaDiagramModal.useEffect] Setting editedSchema:', clonedSchema);
      setEditedSchema(clonedSchema);
      
      // Store initial schema for comparison
      initialSchemaRef.current = JSON.stringify(clonedSchema);
      setHasChanges(false);
      setIsEditMode(false);
      // Force diagram remount with new key
      setDiagramKey(prev => prev + 1);
    } else if (!isOpen) {
      // Reset all state when modal closes
      console.log('[SchemaDiagramModal.useEffect] Resetting state');
      setEditedSchema(null);
      setHasChanges(false);
      setIsEditMode(false);
      setShowUnsavedModal(false);
      initialSchemaRef.current = '';
    }
  }, [isOpen, schema]);

  // Track changes when in edit mode
  useEffect(() => {
    if (!isEditMode || !initialSchemaRef.current || !editedSchema) {
      if (!isEditMode) {
        setHasChanges(false);
      }
      return;
    }
    
    const currentSchemaStr = JSON.stringify(editedSchema);
    const hasSchemaChanges = currentSchemaStr !== initialSchemaRef.current;
    
    console.log('[SchemaDiagramModal] Change detection:', {
      hasSchemaChanges,
      currentLength: currentSchemaStr.length,
      initialLength: initialSchemaRef.current.length,
      isEditMode,
    });
    
    setHasChanges(hasSchemaChanges);
  }, [editedSchema, isEditMode]);

  // Warn before page reload/close when in edit mode with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isEditMode && hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditMode, hasChanges]);

  if (!isOpen) return null;

  const currentSchema = isEditMode ? editedSchema : schema;

  const handleClose = () => {
    if (isEditMode && hasChanges) {
      closeActionRef.current = 'close'; // Track that this is a close action
      setShowUnsavedModal(true);
    } else {
      onClose();
    }
  };

  const handleAddForeignKey = (sourceTable: string, sourceCol: string, targetTable: string, targetCol: string) => {
    if (!editedSchema) return;

    setEditedSchema(prev => {
      if (!prev) return prev;

      const updatedTables = prev.tables.map(table => {
        if (table.name === sourceTable) {
          // Check if FK already exists
          const existingFK = table.foreign_keys?.find(
            fk => fk.column === sourceCol && fk.ref_table === targetTable && fk.ref_column === targetCol
          );

          if (existingFK) {
            toast.info('Foreign key already exists');
            return table;
          }

          return {
            ...table,
            foreign_keys: [
              ...(table.foreign_keys || []),
              {
                column: sourceCol,
                ref_table: targetTable,
                ref_column: targetCol,
              },
            ],
          };
        }
        return table;
      });

      return { ...prev, tables: updatedTables };
    });

    toast.success(`Added foreign key: ${sourceTable}.${sourceCol} → ${targetTable}.${targetCol}`);
  };

  const handleRemoveForeignKey = (sourceTable: string, sourceCol: string, targetTable: string, targetCol: string) => {
    if (!editedSchema) return;

    setEditedSchema(prev => {
      if (!prev) return prev;

      const updatedTables = prev.tables.map(table => {
        if (table.name === sourceTable) {
          return {
            ...table,
            foreign_keys: (table.foreign_keys || []).filter(
              fk => !(fk.column === sourceCol && fk.ref_table === targetTable && fk.ref_column === targetCol)
            ),
          };
        }
        return table;
      });

      return { ...prev, tables: updatedTables };
    });

    toast.success(`Removed foreign key: ${sourceTable}.${sourceCol} → ${targetTable}.${targetCol}`);
  };

  const handleUpdateForeignKey = (
    oldSource: { table: string; col: string },
    newSource: { table: string; col: string },
    newTarget: { table: string; col: string }
  ) => {
    if (!editedSchema) return;

    setEditedSchema(prev => {
      if (!prev) return prev;

      const updatedTables = prev.tables.map(table => {
        // Remove old FK from the old source table
        if (table.name === oldSource.table) {
          const withoutOldFK = {
            ...table,
            foreign_keys: (table.foreign_keys || []).filter(
              fk => !(fk.column === oldSource.col)
            ),
          };

          // If the new source is the same table, add the new FK here
          if (newSource.table === oldSource.table) {
            return {
              ...withoutOldFK,
              foreign_keys: [
                ...withoutOldFK.foreign_keys,
                {
                  column: newSource.col,
                  ref_table: newTarget.table,
                  ref_column: newTarget.col,
                },
              ],
            };
          }

          return withoutOldFK;
        }

        // Add new FK to different source table (if source table changed)
        if (table.name === newSource.table && newSource.table !== oldSource.table) {
          return {
            ...table,
            foreign_keys: [
              ...(table.foreign_keys || []),
              {
                column: newSource.col,
                ref_table: newTarget.table,
                ref_column: newTarget.col,
              },
            ],
          };
        }

        return table;
      });

      return { ...prev, tables: updatedTables };
    });

    toast.success(`Updated foreign key: ${oldSource.table}.${oldSource.col} → ${newSource.table}.${newSource.col} → ${newTarget.table}.${newTarget.col}`);
  };

  const handleSaveChanges = async () => {
    if (!onSave || !editedSchema) return;

    setIsSaving(true);
    try {
      await onSave(editedSchema);
      toast.success('Schema changes saved successfully!');
      
      // Update initial schema ref after successful save
      initialSchemaRef.current = JSON.stringify(editedSchema);
      // hasChanges will be auto-updated by useEffect
      setIsEditMode(false);
      setDiagramKey(prev => prev + 1); // Force re-render diagram
    } catch (error) {
      console.error('Failed to save schema changes:', error);
      toast.error('Failed to save schema changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddColumn = (tableName: string, column: Column) => {
    if (!editedSchema) return;

    setEditedSchema(prev => {
      if (!prev) return prev;

      const updatedTables = prev.tables.map(table => {
        if (table.name === tableName) {
          // Check if column already exists
          if (table.columns.some(col => col.name === column.name)) {
            toast.error(`Column "${column.name}" already exists in table "${tableName}"`);
            return table;
          }

          return {
            ...table,
            columns: [...table.columns, column],
          };
        }
        return table;
      });

      return { ...prev, tables: updatedTables };
    });

    setDiagramKey(prev => prev + 1);
    toast.success(`Added column "${column.name}" to table "${tableName}"`);
  };

  const handleRemoveColumn = (tableName: string, columnName: string) => {
    if (!editedSchema) return;

    setEditedSchema(prev => {
      if (!prev) return prev;

      const updatedTables = prev.tables.map(table => {
        if (table.name === tableName) {
          // Remove column
          const updatedColumns = table.columns.filter(col => col.name !== columnName);
          
          // Remove any foreign keys that reference this column
          const updatedForeignKeys = (table.foreign_keys || []).filter(fk => fk.column !== columnName);

          return {
            ...table,
            columns: updatedColumns,
            foreign_keys: updatedForeignKeys,
          };
        }
        return table;
      });

      // Also remove foreign keys from other tables that reference this column
      const cleanedTables = updatedTables.map(table => ({
        ...table,
        foreign_keys: (table.foreign_keys || []).filter(
          fk => !(fk.ref_table === tableName && fk.ref_column === columnName)
        ),
      }));

      return { ...prev, tables: cleanedTables };
    });

    setDiagramKey(prev => prev + 1);
    toast.success(`Removed column "${columnName}" from table "${tableName}"`);
  };

  const handleUpdateColumn = (tableName: string, columnName: string, newColumn: Column) => {
    if (!editedSchema) return;

    console.log('[handleUpdateColumn]', { tableName, columnName, newColumn });

    setEditedSchema(prev => {
      if (!prev) return prev;

      const updatedTables = prev.tables.map(table => {
        if (table.name === tableName) {
          const updatedColumns = table.columns.map(col => 
            col.name === columnName ? newColumn : col
          );

          return {
            ...table,
            columns: updatedColumns,
          };
        }
        return table;
      });

      return { ...prev, tables: updatedTables };
    });

    setDiagramKey(prev => prev + 1);
    
    if (newColumn.is_pk !== undefined) {
      toast.success(`${newColumn.is_pk ? 'Set' : 'Removed'} primary key for "${columnName}"`);
    } else {
      toast.success(`Updated column "${columnName}" in table "${tableName}"`);
    }
  };

  const handleUpdateTableName = (oldName: string, newName: string) => {
    if (!editedSchema) return;

    console.log('[handleUpdateTableName]', { oldName, newName });

    // Check if new name already exists
    if (editedSchema.tables.some(t => t.name === newName && t.name !== oldName)) {
      toast.error(`Table "${newName}" already exists`);
      return;
    }

    setEditedSchema(prev => {
      if (!prev) return prev;

      const updatedTables = prev.tables.map(table => {
        if (table.name === oldName) {
          return { ...table, name: newName };
        }
        
        // Update foreign key references
        if (table.foreign_keys) {
          return {
            ...table,
            foreign_keys: table.foreign_keys.map(fk => 
              fk.ref_table === oldName 
                ? { ...fk, ref_table: newName }
                : fk
            ),
          };
        }
        
        return table;
      });

      return { ...prev, tables: updatedTables };
    });

    setDiagramKey(prev => prev + 1);
    toast.success(`Renamed table "${oldName}" to "${newName}"`);
  };

  const handleAddTableInDiagram = (tableName: string, position: { x: number; y: number }) => {
    console.log('[handleAddTableInDiagram] Called with:', { tableName, position, editedSchema: !!editedSchema, editedSchemaValue: editedSchema });
    
    // Initialize editedSchema if not exists
    const currentEditedSchema = editedSchema || { tables: [] };
    
    // Create new table with empty columns
    const newTable: TableSchema = {
      name: tableName,
      columns: [],
      foreign_keys: [],
      indexes: [],
      row_count: 0,
    };

    // Check if table already exists
    if (currentEditedSchema.tables.some(t => t.name === tableName)) {
      toast.error(`Table "${tableName}" already exists`);
      return;
    }

    const updated = {
      ...currentEditedSchema,
      tables: [...currentEditedSchema.tables, newTable],
    };
    
    console.log('[handleAddTableInDiagram] Updated schema:', updated);
    setEditedSchema(updated);
    setDiagramKey(prev => prev + 1);
    toast.info(`Table "${tableName}" added. Add columns and save to persist.`);
  };

  const handleEditTableInDiagram = (_tableName: string) => {
    // In edit mode, don't close modal when double-clicking table
    // Just show info that columns can be edited directly on the node
    toast.info(`Edit columns directly on the table node`);
  };

  const handleCancelEdit = () => {
    console.log('[handleCancelEdit] Cancel button clicked, hasChanges:', hasChanges);
    if (hasChanges) {
      closeActionRef.current = 'cancel'; // Track that this is a cancel action
      setShowUnsavedModal(true);
    } else {
      // Reset to initial schema
      if (initialSchemaRef.current) {
        setEditedSchema(JSON.parse(initialSchemaRef.current));
      }
      setIsEditMode(false);
      setDiagramKey(prev => prev + 1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" />

      {/* Modal Content */}
      <div
        className={cn(
          'relative w-[95vw] h-[90vh] rounded-xl shadow-2xl flex flex-col',
          'bg-surface-light dark:bg-surface-dark',
          'border border-border-DEFAULT dark:border-border-dark',
          'overflow-hidden'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-DEFAULT dark:border-border-dark bg-surface-highlight-light dark:bg-surface-highlight-dark flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
              Database Schema Diagram
              {isEditMode && (
                <span className="ml-2 text-sm font-normal text-primary dark:text-primary-dark">
                  (Edit Mode)
                </span>
              )}
            </h2>
            {currentSchema?.database_name && (
              <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">
                {currentSchema.database_name} ({currentSchema.db_type}) - {currentSchema.tables.length} tables
                {hasChanges && <span className="ml-2 text-yellow-600 dark:text-yellow-400">• Unsaved changes</span>}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Edit/View Mode Toggle for Simulations */}
            {isSimulation && !isEditMode && (
              <button
                onClick={() => {
                  console.log('[Edit Button] Entering edit mode, re-syncing editedSchema');
                  // Re-sync editedSchema with current schema when entering edit mode
                  const schemaToClone = schema || { tables: [] };
                  const clonedSchema = JSON.parse(JSON.stringify(schemaToClone));
                  console.log('[Edit Button] Setting editedSchema:', clonedSchema);
                  setEditedSchema(clonedSchema);
                  setIsEditMode(true);
                }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                  'bg-primary dark:bg-primary-dark text-white',
                  'hover:bg-primary-hover dark:hover:bg-primary-dark-hover'
                )}
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}

            {/* Save/Cancel buttons in edit mode */}
            {isEditMode && (
              <>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                    'bg-surface-light dark:bg-surface-dark',
                    'border border-border-DEFAULT dark:border-border-dark',
                    'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                
                <button
                  onClick={handleSaveChanges}
                  disabled={!hasChanges || isSaving}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white relative',
                    'bg-primary dark:bg-primary-dark',
                    'hover:bg-primary-hover dark:hover:bg-primary-dark-hover',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {hasChanges && !isSaving && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-900" />
                  )}
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? 'Saving...' : hasChanges ? 'Save Changes *' : 'Saved'}
                </button>
              </>
            )}
            
            {!isEditMode && (
              <button
                onClick={handleClose}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  'hover:bg-surface-light dark:hover:bg-surface-dark',
                  'text-text-muted-DEFAULT dark:text-text-muted-dark',
                  'hover:text-text-main-DEFAULT dark:hover:text-text-main-dark'
                )}
                aria-label="Close diagram"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        {/* Diagram Content */}
        <div className="flex-1 w-full overflow-hidden">
          <SchemaDiagram 
            key={diagramKey}
            schema={currentSchema} 
            isEditable={isEditMode}
            isSimulation={isSimulation}
            onAddForeignKey={isEditMode ? handleAddForeignKey : undefined}
            onRemoveForeignKey={isEditMode ? handleRemoveForeignKey : undefined}
            onUpdateForeignKey={isEditMode ? handleUpdateForeignKey : undefined}
            onAddTable={isEditMode ? handleAddTableInDiagram : onAddTable}
            onEditTable={isEditMode ? handleEditTableInDiagram : onEditTable}
            onAddColumn={isEditMode ? handleAddColumn : undefined}
            onRemoveColumn={isEditMode ? handleRemoveColumn : undefined}
            onUpdateColumn={isEditMode ? handleUpdateColumn : undefined}
            onUpdateTableName={isEditMode ? handleUpdateTableName : undefined}
          />
        </div>
      </div>

      {/* Unsaved Changes Modal */}
      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        isSaving={isSaving}
        onSave={async () => {
          await handleSaveChanges();
          setShowUnsavedModal(false);
          // Close diagram modal if we were trying to close it
          if (!isEditMode) {
            onClose();
          }
        }}
        onDiscard={() => {
          console.log('[UnsavedChangesModal.onDiscard] Action triggered by:', closeActionRef.current);
          setShowUnsavedModal(false);
          // Reset to initial schema
          if (initialSchemaRef.current) {
            setEditedSchema(JSON.parse(initialSchemaRef.current));
          }
          setIsEditMode(false);
          setDiagramKey(prev => prev + 1);
          // Only close diagram modal if this was triggered by close action (X button or backdrop)
          // Don't close if triggered by Cancel button
          if (closeActionRef.current === 'close') {
            console.log('[UnsavedChangesModal.onDiscard] Closing diagram modal');
            onClose();
          } else {
            console.log('[UnsavedChangesModal.onDiscard] Staying in diagram (edit mode disabled)');
          }
        }}
        onCancel={() => {
          setShowUnsavedModal(false);
          // Don't do anything else - just close the unsaved modal and stay in edit mode
        }}
      />
    </div>
  );
}
