/**
 * Workspace type definitions
 * Represents database connections (real or simulation)
 */

export enum DbType {
  POSTGRES = 'postgres',
  MYSQL = 'mysql',
  SIMULATION = 'simulation',
}

export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  host?: string | null;
  port?: number | null;
  username?: string | null;
  db_name?: string | null;
  db_type: DbType;
  meta_schema?: Record<string, any> | null;
  metadata_cache?: Record<string, any> | null;
  created_at: string;
}

export interface CreateWorkspacePayload {
  name: string;
  db_type: DbType;
  // For real databases
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  db_name?: string;
}

export interface SyncSchemaResponse {
  success: boolean;
  message: string;
  tables_count?: number;
  schema?: Record<string, any>;
}
