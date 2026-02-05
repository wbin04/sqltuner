/**
 * Workspace Service
 * API client for database connections management
 */
import api from '../lib/axios';
import { Workspace, CreateWorkspacePayload, SyncSchemaResponse } from '../types/workspace';

const BASE_URL = '/connections';

export const workspaceService = {
  /**
   * Fetch all workspaces for the current user
   */
  async getAll(): Promise<Workspace[]> {
    const response = await api.get<Workspace[]>(BASE_URL);
    return response.data;
  },

  /**
   * Get a specific workspace by ID
   */
  async getById(id: string): Promise<Workspace> {
    const response = await api.get<Workspace>(`${BASE_URL}/${id}`);
    return response.data;
  },

  /**
   * Create a new workspace (real or simulation)
   */
  async create(payload: CreateWorkspacePayload): Promise<Workspace> {
    const response = await api.post<Workspace>(BASE_URL, payload);
    return response.data;
  },

  /**
   * Update an existing workspace
   */
  async update(id: string, payload: Partial<Workspace>): Promise<Workspace> {
    const response = await api.put<Workspace>(`${BASE_URL}/${id}`, payload);
    return response.data;
  },

  /**
   * Sync schema from a real database
   * Only works for real database connections (not simulations)
   */
  async syncSchema(id: string): Promise<SyncSchemaResponse> {
    const response = await api.post<SyncSchemaResponse>(`${BASE_URL}/${id}/sync`);
    return response.data;
  },

  /**
   * Delete a workspace
   */
  async delete(id: string): Promise<void> {
    await api.delete(`${BASE_URL}/${id}`);
  },

  /**
   * Get schema metadata for a workspace
   */
  async getSchema(id: string): Promise<Record<string, any>> {
    const response = await api.get<Record<string, any>>(`${BASE_URL}/${id}/schema`);
    return response.data;
  },

  /**
   * Get DDL script for a workspace
   */
  async getDDL(id: string): Promise<string> {
    const response = await api.get<string>(`${BASE_URL}/${id}/ddl`);
    return response.data;
  },

  /**
   * Update simulation schema
   * Only for simulation workspaces
   */
  async updateSimulationSchema(id: string, schema: any): Promise<void> {
    await api.put(`${BASE_URL}/${id}/schema`, schema);
  },

  /**
   * Get table data with limit
   * Works for both real and simulation databases
   */
  async getTableData(id: string, tableName: string, limit: number = 100): Promise<{
    columns: string[];
    rows: Record<string, any>[];
    total_rows: number;
  }> {
    const response = await api.get(`${BASE_URL}/${id}/tables/${tableName}/data`, {
      params: { limit }
    });
    return response.data;
  },

  /**
   * Update table data (for simulation or real database)
   */
  async updateTableData(id: string, tableName: string, data: {
    columns: any[];
    sample_data: any[];
  }): Promise<void> {
    // For now, this updates the entire schema
    // TODO: Create dedicated endpoint for single table update
    await api.put(`${BASE_URL}/${id}/tables/${tableName}`, data);
  },

  /**
   * Generate mock data for simulation tables
   */
  async generateMockData(params: {
    count: number;
    columns: Array<{
      name: string;
      type: string;
      is_pk?: boolean;
      is_nullable?: boolean;
    }>;
  }): Promise<Record<string, any>[]> {
    const response = await api.post<{ data: Record<string, any>[]; count: number }>(
      '/simulation/generate-data',
      params
    );
    return response.data.data;
  },

  /**
   * Generate mock data with Foreign Key support
   */
  async generateMockDataWithFK(params: {
    table_name: string;
    count: number;
    schema: any;
  }): Promise<{
    data: Record<string, any>[];
    updated_schema: any;
    tables_modified: string[];
  }> {
    const response = await api.post<{
      data: Record<string, any>[];
      count: number;
      updated_schema: any;
      tables_modified: string[];
    }>(
      '/simulation/generate-data-with-fk',
      params
    );
    return {
      data: response.data.data,
      updated_schema: response.data.updated_schema,
      tables_modified: response.data.tables_modified,
    };
  },
};
