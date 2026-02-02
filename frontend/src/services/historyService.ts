/**
 * Service for History API calls
 */
import axios from '../lib/axios';
import type { HistoryListResponse, HistoryDetail, HistoryFilter } from '../types/history';

const BASE_URL = '/history';

export const historyService = {
  /**
   * Get paginated history list with filters
   */
  async getHistory(filters: HistoryFilter = {}): Promise<HistoryListResponse> {
    const params = new URLSearchParams();
    
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.workspace_id) params.append('workspace_id', filters.workspace_id);
    if (filters.activity_type) params.append('activity_type', filters.activity_type);
    
    const response = await axios.get<HistoryListResponse>(
      `${BASE_URL}?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Get detailed information for a specific history log
   */
  async getHistoryDetail(logId: string): Promise<HistoryDetail> {
    const response = await axios.get<HistoryDetail>(`${BASE_URL}/${logId}`);
    return response.data;
  },

  /**
   * Copy SQL query to clipboard
   */
  async copySQLToClipboard(sql: string): Promise<void> {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(sql);
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = sql;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textArea);
      }
    }
  }
};
