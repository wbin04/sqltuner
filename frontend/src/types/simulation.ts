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
  JSONB = 'JSONB',
  DECIMAL = 'DECIMAL',
  DATE = 'DATE',
}

export interface ForeignKeyTarget {
  table_id: string;
  column_id: string;
}

export interface IndexDef {
  id: string;
  name: string;
  columns: string[]; // Array of column IDs
  unique: boolean;
}

export interface SimulationColumn {
  id: string;
  name: string;
  type: string; // Full SQL type string like "VARCHAR(255)" or "JSONB"
  is_pk: boolean;
  is_nullable: boolean;
  default?: string | null;
  fk_target?: ForeignKeyTarget | null;
}

export interface SimulationTable {
  id: string;
  name: string;
  columns: SimulationColumn[];
  foreign_keys?: Array<{
    column: string;
    ref_table: string;
    ref_column: string;
  }>;
  indexes: IndexDef[];
  sample_data: Record<string, any>[];
}

// Backend response format (without IDs, with foreign_keys array)
export interface BackendTable {
  id?: string;
  name: string;
  columns: Array<{
    id?: string;
    name: string;
    type: string; // Full SQL type string like "VARCHAR(255)" or "JSONB"
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
    id?: string;
    name: string;
    column_names: string[]; // Column names (backend format)
    unique: boolean;
  }>;
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
      column_names: string[]; // Column names
      unique: boolean;
    }>;
    sample_data?: Record<string, any>[];
  }>;
}
