/**
 * HistoryPage - Global query history across all workspaces
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { historyService } from '../services/historyService';
import { HistoryTable } from '../components/history/HistoryTable';
import { HistoryDetailDrawer } from '../components/history/HistoryDetailDrawer';
import type { HistoryLog, HistoryFilter, ActivityType } from '../types/history';

export function HistoryPage() {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [filters, setFilters] = useState<HistoryFilter>({
    page: 1,
    limit: 20,
    search: '',
    workspace_id: undefined,
    activity_type: undefined,
  });

  // Debounced search state
  const [searchInput, setSearchInput] = useState('');

  // Fetch history data
  const { data, isLoading, error } = useQuery({
    queryKey: ['history', filters],
    queryFn: () => historyService.getHistory(filters),
  });

  // Fetch all workspaces for filter dropdown
  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      // Import workspaceService here to avoid circular deps
      const { workspaceService } = await import('../services/workspaceService');
      return workspaceService.getAll();
    },
  });

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }));
  };

  const handleCopySQL = async (sql: string) => {
    try {
      await historyService.copySQLToClipboard(sql);
      // You can add a toast notification here
      console.log('SQL copied to clipboard');
    } catch (error) {
      console.error('Failed to copy SQL:', error);
    }
  };

  const handleViewDetail = (log: HistoryLog) => {
    setSelectedLogId(log.id);
  };

  const handleCloseDrawer = () => {
    setSelectedLogId(null);
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const totalPages = data ? Math.ceil(data.total / filters.limit!) : 1;

  return (
    <div className="h-full flex flex-col bg-background-light dark:bg-background-dark">
      {/* Header */}
      <div className="px-6 py-6 border-b border-border-light dark:border-border-dark">
        <h1 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark mb-2">
          Global History
        </h1>
        <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">
          Search and audit your activities across all workspaces
        </p>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-4 border-b border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark">
        <div className="flex flex-wrap gap-4">
          {/* Search Input */}
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted-DEFAULT dark:text-text-muted-dark" />
              <input
                type="text"
                placeholder="Search by SQL content or prompt..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-border-light dark:border-border-dark rounded-lg 
                         bg-background-light dark:bg-background-dark 
                         text-text-main-DEFAULT dark:text-text-main-dark
                         placeholder:text-text-muted-DEFAULT dark:placeholder:text-text-muted-dark
                         focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Workspace Filter */}
          <div className="w-48">
            <select
              value={filters.workspace_id || ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  workspace_id: e.target.value || undefined,
                  page: 1,
                }))
              }
              className="w-full px-4 py-2 border border-border-light dark:border-border-dark rounded-lg 
                       bg-background-light dark:bg-background-dark 
                       text-text-main-DEFAULT dark:text-text-main-dark
                       focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Workspaces</option>
              {workspaces?.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>

          {/* Activity Type Filter */}
          <div className="w-48">
            <select
              value={filters.activity_type || ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  activity_type: (e.target.value as ActivityType) || undefined,
                  page: 1,
                }))
              }
              className="w-full px-4 py-2 border border-border-light dark:border-border-dark rounded-lg 
                       bg-background-light dark:bg-background-dark 
                       text-text-main-DEFAULT dark:text-text-main-dark
                       focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Activities</option>
              <option value="optimization">Optimization</option>
              <option value="execution">Execution</option>
              <option value="chat">Chat</option>
            </select>
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 
                     transition-colors font-medium"
          >
            Search
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-500 dark:text-red-400 mb-2">Failed to load history</p>
              <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          </div>
        ) : data && data.items.length > 0 ? (
          <>
            <HistoryTable
              data={data.items}
              onViewDetail={handleViewDetail}
              onCopySQL={handleCopySQL}
            />

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                Showing {(filters.page! - 1) * filters.limit! + 1} to{' '}
                {Math.min(filters.page! * filters.limit!, data.total)} of {data.total} results
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(filters.page! - 1)}
                  disabled={filters.page === 1}
                  className="px-3 py-2 border border-border-light dark:border-border-dark rounded-lg 
                           disabled:opacity-50 disabled:cursor-not-allowed
                           hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <span className="px-4 py-2 text-sm text-text-main-DEFAULT dark:text-text-main-dark">
                  Page {filters.page} of {totalPages}
                </span>

                <button
                  onClick={() => handlePageChange(filters.page! + 1)}
                  disabled={filters.page === totalPages}
                  className="px-3 py-2 border border-border-light dark:border-border-dark rounded-lg 
                           disabled:opacity-50 disabled:cursor-not-allowed
                           hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64">
            <Filter className="w-16 h-16 text-text-muted-DEFAULT dark:text-text-muted-dark mb-4" />
            <p className="text-lg font-medium text-text-main-DEFAULT dark:text-text-main-dark mb-2">
              No history found
            </p>
            <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
              Try adjusting your filters or search query
            </p>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <HistoryDetailDrawer logId={selectedLogId} onClose={handleCloseDrawer} />
    </div>
  );
}
