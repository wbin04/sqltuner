/**
 * HistoryDetailDrawer - Right-side slide-over for viewing full history details
 */
import { X, Database, ExternalLink, Clock, TrendingDown, FileCode } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { historyService } from '../../services/historyService';
import type { HistoryDetail } from '../../types/history';
import { useNavigate } from 'react-router-dom';

interface HistoryDetailDrawerProps {
  logId: string | null;
  onClose: () => void;
}

export function HistoryDetailDrawer({ logId, onClose }: HistoryDetailDrawerProps) {
  const navigate = useNavigate();

  const { data: detail, isLoading } = useQuery<HistoryDetail>({
    queryKey: ['history-detail', logId],
    queryFn: () => historyService.getHistoryDetail(logId!),
    enabled: !!logId,
  });

  if (!logId) return null;

  const handleOpenInWorkspace = () => {
    if (detail?.workspace.id) {
      navigate(`/editor/${detail.workspace.id}`);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-background-light dark:bg-background-dark shadow-2xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark">
            Query Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-background-light dark:hover:bg-background-dark rounded-md transition-colors"
          >
            <X className="w-5 h-5 text-text-muted-DEFAULT dark:text-text-muted-dark" />
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : detail ? (
          <div className="px-6 py-6 space-y-6">
            {/* Workspace Info */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-medium text-text-main-DEFAULT dark:text-text-main-dark">
                      {detail.workspace.name}
                    </h3>
                    <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                      {detail.workspace.db_type} • {new Date(detail.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleOpenInWorkspace}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in Workspace</span>
                </button>
              </div>
            </div>

            {/* Activity Type & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-light dark:bg-surface-dark rounded-lg p-4">
                <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark mb-1">
                  Activity Type
                </p>
                <p className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark capitalize">
                  {detail.activity_type}
                </p>
              </div>
              <div className="bg-surface-light dark:bg-surface-dark rounded-lg p-4">
                <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark mb-1">
                  Status
                </p>
                <p className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark capitalize">
                  {detail.result_status || 'N/A'}
                </p>
              </div>
            </div>

            {/* Performance Metrics */}
            {(detail.execution_time_ms || detail.total_cost) && (
              <div className="grid grid-cols-2 gap-4">
                {detail.execution_time_ms && (
                  <div className="bg-surface-light dark:bg-surface-dark rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                        Execution Time
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark">
                      {detail.execution_time_ms.toFixed(2)} ms
                    </p>
                  </div>
                )}
                {detail.total_cost && (
                  <div className="bg-surface-light dark:bg-surface-dark rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown className="w-4 h-4 text-green-500" />
                      <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                        Query Cost
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark">
                      {detail.total_cost.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* User Prompt */}
            {detail.user_prompt && (
              <div>
                <h3 className="text-sm font-medium text-text-muted-DEFAULT dark:text-text-muted-dark mb-2">
                  User Prompt
                </h3>
                <div className="bg-surface-light dark:bg-surface-dark rounded-lg p-4">
                  <p className="text-sm text-text-main-DEFAULT dark:text-text-main-dark whitespace-pre-wrap">
                    {detail.user_prompt}
                  </p>
                </div>
              </div>
            )}

            {/* SQL Query */}
            {detail.sql_query && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-text-muted-DEFAULT dark:text-text-muted-dark flex items-center gap-2">
                    <FileCode className="w-4 h-4" />
                    SQL Query
                  </h3>
                  <button
                    onClick={() => historyService.copySQLToClipboard(detail.sql_query!)}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    Copy SQL
                  </button>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-100 font-mono">
                    {detail.sql_query}
                  </pre>
                </div>
              </div>
            )}

            {/* AI Response */}
            {detail.ai_response && (
              <div>
                <h3 className="text-sm font-medium text-text-muted-DEFAULT dark:text-text-muted-dark mb-2">
                  AI Response
                </h3>
                <div className="bg-surface-light dark:bg-surface-dark rounded-lg p-4">
                  <p className="text-sm text-text-main-DEFAULT dark:text-text-main-dark whitespace-pre-wrap">
                    {detail.ai_response}
                  </p>
                </div>
              </div>
            )}

            {/* Index Recommendations */}
            {detail.index_recommendation && (
              <div>
                <h3 className="text-sm font-medium text-text-muted-DEFAULT dark:text-text-muted-dark mb-2">
                  Index Recommendations
                </h3>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <p className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap">
                    {detail.index_recommendation}
                  </p>
                </div>
              </div>
            )}

            {/* Explain Plan */}
            {detail.explain_plan && (
              <div>
                <h3 className="text-sm font-medium text-text-muted-DEFAULT dark:text-text-muted-dark mb-2">
                  Execution Plan
                </h3>
                <div className="bg-surface-light dark:bg-surface-dark rounded-lg p-4 overflow-x-auto">
                  <pre className="text-xs text-text-main-DEFAULT dark:text-text-main-dark font-mono">
                    {JSON.stringify(detail.explain_plan, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">
              Failed to load details
            </p>
          </div>
        )}
      </div>
    </>
  );
}
