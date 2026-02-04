/**
 * Type definitions for Simulation Schema Designer
 */

export enum ColumnType {
  UUID = 'UUID',
  VARCHAR = 'VARCHAR',
  INTEGER = 'INTEGER',
  BOOLEAN = 'BOOLEAN',
  TIMESTAMP = 'TIMESTAMP',
  TEXT = 'TEXT',
  JSON = 'JSON',
  DECIMAL = 'DECIMAL',
  DATE = 'DATE',
}

export interface ForeignKeyTarget {
  table_id: string;
  column_id: string;
}

export interface SimulationColumn {
  id: string;
  name: string;
  type: ColumnType;
  is_pk: boolean;
  is_nullable: boolean;
  default?: string | null;
  fk_target?: ForeignKeyTarget | null;
}

export interface SimulationTable {
  id: string;
  name: string;
  columns: SimulationColumn[];
  sample_data: Record<string, any>[];
}

// Backend response format (without IDs, with foreign_keys array)
export interface BackendTable {
  id?: string;
  name: string;
  columns: Array<{
    id?: string;
    name: string;
    type: ColumnType;
    is_pk: boolean;
    is_nullable: boolean;
    default?: string | null;
  }>;
  foreign_keys?: Array<{
    column: string;
    ref_table: string;
    ref_column: string;
  }>;
  indexes?: any[];
  row_count?: number | null;
  sample_data?: Record<string, any>[];
}

export interface SimulationSchema {
  is_simulation: true;
  tables: SimulationTable[];
}

export interface UpdateSchemaPayload {
  tables: Array<{
    name: string;
    columns: Array<{
      name: string;
      type: string;
      is_pk: boolean;
      is_nullable: boolean;
      default?: string | null;
    }>;
    foreign_keys?: Array<{
      column: string;
      ref_table: string;
      ref_column: string;
    }>;
    indexes?: Array<{
      name: string;
      column_names: string[];
      unique: boolean;
    }>;
    sample_data?: Record<string, any>[];
  }>;
}
