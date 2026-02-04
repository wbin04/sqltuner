/**
 * SchemaDiagramModal Component
 * Full-screen modal overlay for displaying the schema diagram
 */
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { SchemaDiagram } from './SchemaDiagram';

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
}

export function SchemaDiagramModal({ isOpen, onClose, schema }: SchemaDiagramModalProps) {
  if (!isOpen) return null;

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
            </h2>
            {schema?.database_name && (
              <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">
                {schema.database_name} ({schema.db_type}) - {schema.tables.length} tables
              </p>
            )}
          </div>
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

        {/* Diagram Content */}
        <div className="flex-1 w-full overflow-hidden">
          <SchemaDiagram schema={schema} />
        </div>
      </div>
    </div>
  );
}
