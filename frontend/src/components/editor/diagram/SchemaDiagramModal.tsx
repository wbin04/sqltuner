/**
 * SchemaDiagramModal Component
 * Full-screen modal overlay for displaying the schema diagram
 */
import { useState, useEffect } from 'react';
import { X, Save, Edit } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { SchemaDiagram } from './SchemaDiagram';
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
}

export function SchemaDiagramModal({ isOpen, onClose, schema, isSimulation = false, onSave }: SchemaDiagramModalProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedSchema, setEditedSchema] = useState<SchemaDef | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [diagramKey, setDiagramKey] = useState(0);

  // Initialize edited schema when modal opens and reset when closes
  useEffect(() => {
    if (isOpen && schema) {
      // Deep clone to avoid reference issues
      setEditedSchema(JSON.parse(JSON.stringify(schema)));
      setHasChanges(false);
      setIsEditMode(false);
      // Force diagram remount with new key
      setDiagramKey(prev => prev + 1);
    } else if (!isOpen) {
      // Reset all state when modal closes
      setEditedSchema(null);
      setHasChanges(false);
      setIsEditMode(false);
    }
  }, [isOpen, schema]);

  if (!isOpen) return null;

  const currentSchema = isEditMode ? editedSchema : schema;

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

    setHasChanges(true);
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

    setHasChanges(true);
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

    setHasChanges(true);
    toast.success(`Updated foreign key: ${oldSource.table}.${oldSource.col} → ${newSource.table}.${newSource.col} → ${newTarget.table}.${newTarget.col}`);
  };

  const handleSaveChanges = async () => {
    if (!onSave || !editedSchema) return;

    setIsSaving(true);
    try {
      await onSave(editedSchema);
      toast.success('Schema changes saved successfully!');
      setHasChanges(false);
      setIsEditMode(false);
    } catch (error) {
      console.error('Failed to save schema:', error);
      toast.error('Failed to save schema changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (hasChanges) {
      if (window.confirm('Discard unsaved changes?')) {
        setEditedSchema(schema ? JSON.parse(JSON.stringify(schema)) : null);
        setHasChanges(false);
        setIsEditMode(false);
      }
    } else {
      setIsEditMode(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
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
                onClick={() => setIsEditMode(true)}
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
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                    'bg-green-600 dark:bg-green-600 text-white',
                    'hover:bg-green-700 dark:hover:bg-green-700',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
            
            <button
              onClick={onClose}
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
          </div>
        </div>

        {/* Diagram Content */}
        <div className="flex-1 w-full overflow-hidden">
          <SchemaDiagram 
            key={diagramKey}
            schema={currentSchema} 
            isEditable={isEditMode}
            onAddForeignKey={handleAddForeignKey}
            onRemoveForeignKey={handleRemoveForeignKey}
            onUpdateForeignKey={handleUpdateForeignKey}
          />
        </div>
      </div>
    </div>
  );
}
