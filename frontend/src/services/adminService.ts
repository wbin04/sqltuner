/**
 * Admin Service
 * API client for admin dashboard, user management, and connections management
 */
import api from '../lib/axios';

const BASE_URL = '/admin';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_users: number;
  active_users: number;
  total_connections: number;
  total_queries: number;
  total_conversations: number;
  total_feedbacks: number;
  thumbs_up: number;
  thumbs_down: number;
}

export interface QueriesPerHour {
  hour: string;
  queries: number;
}

export interface SatisfactionDay {
  date: string;
  thumbs_up: number;
  thumbs_down: number;
}

export interface RecentActivity {
  user_email: string;
  action: string;
  time: string;
}

export interface DashboardResponse {
  stats: DashboardStats;
  queries_per_hour: QueriesPerHour[];
  satisfaction_trend: SatisfactionDay[];
  recent_activity: RecentActivity[];
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  auth_provider: string;
  created_at: string;
  connections_count: number;
  queries_count: number;
}

export interface AdminUserUpdate {
  role?: string;
  is_active?: boolean;
}

export interface AdminConnection {
  id: string;
  user_id: string;
  user_email: string;
  name: string;
  db_type: string;
  host: string | null;
  port: number | null;
  db_name: string | null;
  tables_count: number;
  created_at: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const adminService = {
  /**
   * Get dashboard overview data
   */
  async getDashboard(): Promise<DashboardResponse> {
    const response = await api.get<DashboardResponse>(`${BASE_URL}/dashboard`);
    return response.data;
  },

  /**
   * List all users (admin only)
   */
  async getUsers(search?: string): Promise<AdminUser[]> {
    const params = search ? { search } : {};
    const response = await api.get<AdminUser[]>(`${BASE_URL}/users`, { params });
    return response.data;
  },

  /**
   * Update user role or active status
   */
  async updateUser(userId: string, data: AdminUserUpdate): Promise<AdminUser> {
    const response = await api.patch<AdminUser>(`${BASE_URL}/users/${userId}`, data);
    return response.data;
  },

  /**
   * Delete a user
   */
  async deleteUser(userId: string): Promise<void> {
    await api.delete(`${BASE_URL}/users/${userId}`);
  },

  /**
   * List all DB connections across all users
   */
  async getConnections(search?: string): Promise<AdminConnection[]> {
    const params = search ? { search } : {};
    const response = await api.get<AdminConnection[]>(`${BASE_URL}/connections`, { params });
    return response.data;
  },
};
