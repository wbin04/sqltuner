/**
 * SampleDataEditor Component
 * Spreadsheet-like editor for table sample data
 */
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SimulationTable } from '../../types/simulation';
import { v4 as uuidv4 } from 'uuid';

interface SampleDataEditorProps {
  table: SimulationTable;
  isReadOnly?: boolean;
  onUpdateTable: (table: SimulationTable) => void;
}

export function SampleDataEditor({ table, isReadOnly = false, onUpdateTable }: SampleDataEditorProps) {
  const handleAddRow = () => {
    const newRow: Record<string, any> = {};
    table.columns.forEach(col => {
      newRow[col.name] = col.type === 'UUID' ? uuidv4() : '';
    });

    onUpdateTable({
      ...table,
      sample_data: [...table.sample_data, newRow],
    });
  };

  const handleDeleteRow = (index: number) => {
    onUpdateTable({
      ...table,
      sample_data: table.sample_data.filter((_, i) => i !== index),
    });
  };

  const handleUpdateCell = (rowIndex: number, columnName: string, value: any) => {
    const updatedData = [...table.sample_data];
    updatedData[rowIndex] = {
      ...updatedData[rowIndex],
      [columnName]: value,
    };

    onUpdateTable({
      ...table,
      sample_data: updatedData,
    });
  };

  const getCellValue = (row: Record<string, any>, columnName: string): string => {
    const value = row[columnName];
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
          Sample Data for {table.name}
        </h3>
        <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">
          {table.sample_data.length} rows
        </p>
      </div>

      {/* Data Grid */}
      <div className="bg-surface-DEFAULT dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-highlight-light dark:bg-surface-highlight-dark sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted-DEFAULT dark:text-text-muted-dark uppercase w-12">
                #
              </th>
              {table.columns.map((column) => (
                <th
                  key={column.id}
                  className="px-4 py-3 text-left text-xs font-semibold text-text-muted-DEFAULT dark:text-text-muted-dark uppercase"
                >
                  <div>
                    {column.name}
                    <div className="text-xs font-normal text-text-muted-DEFAULT dark:text-text-muted-dark mt-0.5">
                      {column.type}
                    </div>
                  </div>
                </th>
              ))}
              <th className={cn("px-4 py-3 text-center text-xs font-semibold text-text-muted-DEFAULT dark:text-text-muted-dark uppercase w-20", isReadOnly && "hidden")}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {table.sample_data.length === 0 ? (
              <tr>
                <td
                  colSpan={table.columns.length + 2}
                  className="px-4 py-8 text-center text-text-muted-DEFAULT dark:text-text-muted-dark"
                >
                  No sample data yet. Click "Add Row" to create sample data.
                </td>
              </tr>
            ) : (
              table.sample_data.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-t border-border-DEFAULT dark:border-border-dark hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark"
                >
                  <td className="px-4 py-2 text-text-muted-DEFAULT dark:text-text-muted-dark">
                    {rowIndex + 1}
                  </td>
                  {table.columns.map((column) => (
                    <td key={column.id} className="px-4 py-2">
                      <input
                        type="text"
                        value={getCellValue(row, column.name)}
                        onChange={(e) => handleUpdateCell(rowIndex, column.name, e.target.value)}
                        placeholder={column.is_nullable ? 'null' : ''}
                        readOnly={isReadOnly}
                        className={cn(
                          'w-full px-3 py-1.5 rounded border font-mono text-sm',
                          'bg-background-light dark:bg-background-dark',
                          'border-border-DEFAULT dark:border-border-dark',
                          'text-text-main-DEFAULT dark:text-text-main-dark',
                          'placeholder:text-text-muted-DEFAULT dark:placeholder:text-text-muted-dark',
                          'focus:outline-none focus:ring-2 focus:ring-primary/50'
                        )}
                      />
                    </td>
                  ))}
                  <td className={cn("px-4 py-2 text-center", isReadOnly && "hidden")}>
                    <button
                      onClick={() => handleDeleteRow(rowIndex)}
                      disabled={isReadOnly}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors disabled:hidden disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Row Button */}
      <button
        onClick={handleAddRow}
        disabled={isReadOnly}
        className={cn(
          'mt-4 flex items-center gap-2 px-4 py-2 rounded-lg',
          'text-primary dark:text-primary-dark',
          'hover:bg-primary/5 dark:hover:bg-primary-dark/5',
          'transition-colors font-medium',
          'disabled:hidden disabled:cursor-not-allowed'
        )}
      >
        <Plus className="w-4 h-4" />
        Add Row
      </button>
    </div>
  );
}
