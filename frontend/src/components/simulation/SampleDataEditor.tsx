/**
 * SampleDataEditor Component
 * Spreadsheet-like editor for table sample data
 */
import { useState } from 'react';
import { Plus, Trash2, Sparkles, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SimulationTable, SimulationSchema } from '../../types/simulation';
import { workspaceService } from '../../services/workspaceService';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';
import { JSONViewerModal } from '../editor/JSONViewerModal';
import { SmartCell } from './SmartCell';

interface SampleDataEditorProps {
  table: SimulationTable;
  schema?: SimulationSchema;
  isReadOnly?: boolean;
  onUpdateTable: (table: SimulationTable) => void;
  onUpdateSchema?: (schema: SimulationSchema) => void;
}

export function SampleDataEditor({ table, schema, isReadOnly = false, onUpdateTable, onUpdateSchema }: SampleDataEditorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGeneratePopover, setShowGeneratePopover] = useState(false);
  const [rowCount, setRowCount] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [jsonViewerData, setJsonViewerData] = useState<{ data: any; column: string } | null>(null);

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

  const handleGenerateData = async () => {
    if (table.columns.length === 0) {
      toast.error('Please add columns to the table first');
      return;
    }

    setIsGenerating(true);
    setShowGeneratePopover(false);

    try {
      console.log('=== Generate Data ===');
      console.log('Table:', table.name);
      console.log('Table object:', table);
      console.log('Columns:', table.columns);
      
      const columnsWithFK = table.columns.filter(c => c.fk_target);
      console.log('Columns with fk_target:', columnsWithFK);
      
      let foreignKeys = table.foreign_keys || [];
      
      if (foreignKeys.length === 0 && columnsWithFK.length > 0 && schema) {
        console.log('Converting fk_target to foreign_keys');
        foreignKeys = columnsWithFK.map(col => {
          const refTable = schema.tables.find(t => t.id === col.fk_target?.table_id);
          const refColumn = refTable?.columns.find(c => c.id === col.fk_target?.column_id);
          
          return {
            column: col.name,
            ref_table: refTable?.name || '',
            ref_column: refColumn?.name || '',
          };
        }).filter(fk => fk.ref_table && fk.ref_column);
        
        console.log('Converted foreign_keys:', foreignKeys);
      }
      
      const hasForeignKeys = foreignKeys.length > 0;
      let newRows: Record<string, any>[];

      console.log('Has FK:', hasForeignKeys);
      console.log('FK:', foreignKeys);

      if (hasForeignKeys && schema) {
        console.log('Using FK-aware endpoint');
        const schemaPayload = {
          tables: schema.tables.map(t => {
            let tableFKs = t.foreign_keys || [];
            
            if (tableFKs.length === 0) {
              const tColumnsWithFK = t.columns.filter(c => c.fk_target);
              if (tColumnsWithFK.length > 0) {
                tableFKs = tColumnsWithFK.map(col => {
                  const refTable = schema.tables.find(tb => tb.id === col.fk_target?.table_id);
                  const refColumn = refTable?.columns.find(c => c.id === col.fk_target?.column_id);
                  
                  return {
                    column: col.name,
                    ref_table: refTable?.name || '',
                    ref_column: refColumn?.name || '',
                  };
                }).filter(fk => fk.ref_table && fk.ref_column);
              }
            }
            
            return {
              name: t.name,
              columns: t.columns.map(c => ({
                name: c.name,
                type: c.type,
                is_pk: c.is_pk,
                is_nullable: c.is_nullable,
              })),
              foreign_keys: tableFKs,
              sample_data: t.sample_data || [],
            };
          }),
        };

        console.log('Schema payload:', JSON.stringify(schemaPayload, null, 2));

        const result = await workspaceService.generateMockDataWithFK({
          table_name: table.name,
          count: rowCount,
          schema: schemaPayload,
        });

        newRows = result.data;

        console.log('Tables modified:', result.tables_modified);
        
        if (result.tables_modified.length > 0 && onUpdateSchema && schema) {
          const updatedSchema = result.updated_schema;
          
          const newSchema = {
            ...schema,
            tables: schema.tables.map(t => {
              const updatedTable = updatedSchema.tables.find(
                (ut: any) => ut.name === t.name
              );
              if (updatedTable && result.tables_modified.includes(t.name)) {
                return {
                  ...t,
                  sample_data: updatedTable.sample_data || t.sample_data,
                };
              }
              return t;
            }),
          };
          
          onUpdateSchema(newSchema);
          
          const modifiedOthers = result.tables_modified.filter(
            name => name !== table.name
          );
          if (modifiedOthers.length > 0) {
            toast.info(
              `Auto-generated data for parent tables: ${modifiedOthers.join(', ')}`,
              {
                position: 'top-right',
                autoClose: 5000,
              }
            );
          }
        }
      } else {
        console.log('Using simple endpoint (no FK)');
        const columns = table.columns.map(col => ({
          name: col.name,
          type: col.type,
          is_pk: col.is_pk,
          is_nullable: col.is_nullable,
        }));

        newRows = await workspaceService.generateMockData({
          columns,
          count: rowCount,
        });
      }

      onUpdateTable({
        ...table,
        sample_data: [...table.sample_data, ...newRows],
      });

      toast.success(`Successfully generated ${newRows.length} rows!`, {
        position: 'top-right',
        autoClose: 3000,
      });
    } catch (error) {
      console.error('Failed to generate data:', error);
      toast.error('Failed to generate mock data. Please try again.', {
        position: 'top-right',
        autoClose: 5000,
      });
    } finally {
      setIsGenerating(false);
    }
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

  const filteredData = table.sample_data.filter((row) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return table.columns.some((column) => {
      const cellValue = getCellValue(row, column.name).toLowerCase();
      return cellValue.includes(query);
    });
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
            Sample Data for {table.name}
          </h3>
          <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">
            {filteredData.length} of {table.sample_data.length} rows
            {searchQuery && ` (filtered)`}
          </p>
        </div>

        {/* Generate Data Toolbar */}
        {!isReadOnly && table.columns.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowGeneratePopover(!showGeneratePopover)}
              disabled={isGenerating}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg',
                'bg-primary dark:bg-primary-dark text-white',
                'hover:bg-primary/90 dark:hover:bg-primary-dark/90',
                'transition-colors font-medium',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <Sparkles className="w-4 h-4" />
              {isGenerating ? 'Generating...' : 'Generate Data'}
            </button>

            {/* Generate Data Popover */}
            {showGeneratePopover && (
              <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg border border-border-DEFAULT dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-lg">
                <div className="p-4">
                  <h4 className="text-sm font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-3">
                    Generate Mock Data
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-text-muted-DEFAULT dark:text-text-muted-dark mb-1">
                        Number of rows
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={rowCount}
                        onChange={(e) => setRowCount(Math.max(1, Math.min(1000, parseInt(e.target.value) || 50)))}
                        className={cn(
                          'w-full px-3 py-2 rounded-lg border',
                          'bg-background-light dark:bg-background-dark',
                          'border-border-DEFAULT dark:border-border-dark',
                          'text-text-main-DEFAULT dark:text-text-main-dark',
                          'focus:outline-none focus:ring-2 focus:ring-primary/50'
                        )}
                      />
                      <p className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">
                        Maximum: 1000 rows
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleGenerateData}
                        className={cn(
                          'flex-1 px-4 py-2 rounded-lg',
                          'bg-primary dark:bg-primary-dark text-white',
                          'hover:bg-primary/90 dark:hover:bg-primary-dark/90',
                          'transition-colors font-medium'
                        )}
                      >
                        Generate
                      </button>
                      <button
                        onClick={() => setShowGeneratePopover(false)}
                        className={cn(
                          'flex-1 px-4 py-2 rounded-lg',
                          'bg-surface-highlight-light dark:bg-surface-highlight-dark',
                          'text-text-main-DEFAULT dark:text-text-main-dark',
                          'hover:bg-surface-highlight-light/80 dark:hover:bg-surface-highlight-dark/80',
                          'transition-colors font-medium'
                        )}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search Bar */}
      {table.sample_data.length > 0 && (
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted-DEFAULT dark:text-text-muted-dark" />
            <input
              type="text"
              placeholder="Search in all columns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-full pl-10 pr-4 py-2 rounded-lg border',
                'bg-background-light dark:bg-background-dark',
                'border-border-DEFAULT dark:border-border-dark',
                'text-text-main-DEFAULT dark:text-text-main-dark',
                'placeholder:text-text-muted-DEFAULT dark:placeholder:text-text-muted-dark',
                'focus:outline-none focus:ring-2 focus:ring-primary/50'
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted-DEFAULT dark:text-text-muted-dark hover:text-text-main-DEFAULT dark:hover:text-text-main-dark"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Data Grid */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-highlight-light dark:bg-surface-highlight-dark sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted-DEFAULT dark:text-text-muted-dark uppercase w-12">
                #
              </th>
              {table.columns.map((column) => (
                <th
                  key={column.id}
                  className="px-4 py-3 text-left text-xs font-semibold text-text-muted-DEFAULT dark:text-text-muted-dark uppercase min-w-[150px] max-w-[300px]"
                >
                  <div className="whitespace-nowrap overflow-hidden text-ellipsis">
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
            {filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={table.columns.length + 2}
                  className="px-4 py-8 text-center text-text-muted-DEFAULT dark:text-text-muted-dark"
                >
                  {searchQuery ? `No results found for "${searchQuery}"` : 'No sample data yet. Click "Add Row" to create sample data.'}
                </td>
              </tr>
            ) : (
              filteredData.map((row) => {
                const originalIndex = table.sample_data.indexOf(row);
                return (
                  <tr
                    key={originalIndex}
                    className="border-t border-border-DEFAULT dark:border-border-dark hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark"
                  >
                    <td className="px-4 py-2 text-text-muted-DEFAULT dark:text-text-muted-dark">
                      {originalIndex + 1}
                    </td>
                    {table.columns.map((column) => {
                      const value = row[column.name];
                      
                      return (
                        <td key={column.id} className="px-4 py-2 min-w-[150px] max-w-[300px] border-b border-border-DEFAULT dark:border-border-dark">
                          <SmartCell
                            value={value}
                            type={column.type}
                            onSave={(newValue) => handleUpdateCell(originalIndex, column.name, newValue)}
                            onJsonClick={() => setJsonViewerData({ data: value, column: column.name })}
                            isReadOnly={isReadOnly}
                          />
                        </td>
                      );
                    })}
                    <td className={cn("px-4 py-2 text-center", isReadOnly && "hidden")}>
                      <button
                        onClick={() => handleDeleteRow(originalIndex)}
                        disabled={isReadOnly}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors disabled:hidden disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
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

      {/* JSON Viewer Modal */}
      <JSONViewerModal
        isOpen={jsonViewerData !== null}
        onClose={() => setJsonViewerData(null)}
        jsonData={jsonViewerData?.data}
        columnName={jsonViewerData?.column}
      />
    </div>
  );
}
