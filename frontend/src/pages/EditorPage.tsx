/**
 * EditorPage
 * Main SQL editor with 3-pane IDE layout
 * Pane A: Session Manager (Left) | Pane B: Chat Workbench (Center) | Pane C: Schema Viewer (Right)
 * Implements auto-sync logic for real databases with empty schema
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Database, Loader2, AlertCircle, RefreshCw, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { useWorkspace } from '../hooks/useWorkspace';
import { useEditorLogic } from '../hooks/useEditorLogic';
import { SchemaViewer } from '../components/editor/SchemaViewer';
import { SessionManager } from '../components/editor/SessionManager';
import { ChatArea } from '../components/editor/ChatArea';
import { OptimizationModal } from '../components/editor/OptimizationModal';
import { DbType } from '../types/workspace';
import { extractErrorMessage, getSQLErrorSuggestion } from '../utils/sqlErrorHelper';

export function EditorPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [autoSyncTriggered, setAutoSyncTriggered] = useState(false);
  const [activeResultSql, setActiveResultSql] = useState<string | null>(null);
  const [isResultsCollapsed, setIsResultsCollapsed] = useState(true); // Default to collapsed
  const [resultsPanelHeight, setResultsPanelHeight] = useState(300); // Default height in pixels
  const [isResizing, setIsResizing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  if (!workspaceId) {
    navigate('/workspaces');
    return null;
  }

  const { workspace, isLoading, isError, error, syncSchema, isSyncing } = useWorkspace(workspaceId);

  // Use editor logic hook
  const editorLogic = useEditorLogic({ connectionId: workspaceId });

  // Handlers that integrate with editor logic
  const handleSendMessage = (content: string) => {
    editorLogic.handleSendMessage(content);
  };

  const handleRunQuery = async (sql: string) => {
    // Immediately show results panel with loading state
    setActiveResultSql(sql);
    setIsResultsCollapsed(false);
    
    // Execute query (this will update loading state)
    await editorLogic.handleRunQuery(sql);
  };

  const handleOptimize = (sql: string) => {
    editorLogic.handleOptimize(sql);
  };

  const handleExplain = async (sql: string) => {
    await editorLogic.handleExplain(sql);
  };

  // Handle resize of results panel
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newHeight = window.innerHeight - e.clientY;
      setResultsPanelHeight(Math.max(100, Math.min(600, newHeight))); // Min 100px, Max 600px
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Auto-sync logic: Trigger sync if real DB with empty schema
  useEffect(() => {
    if (!workspace || autoSyncTriggered) return;

    const isRealDatabase = workspace.db_type !== DbType.SIMULATION;
    const schemaIsEmpty = !workspace.meta_schema || Object.keys(workspace.meta_schema).length === 0;

    if (isRealDatabase && schemaIsEmpty) {
      console.log('[EditorPage] Auto-syncing schema for real database...');
      setAutoSyncTriggered(true);
      syncSchema();
    }
  }, [workspace, autoSyncTriggered, syncSchema]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary dark:text-primary-dark" />
          <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">
            Loading workspace...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError || !workspace) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-2">
            Failed to Load Workspace
          </h2>
          <p className="text-text-muted-DEFAULT dark:text-text-muted-dark mb-6">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => navigate('/workspaces')}
            className={cn(
              'px-4 py-2 rounded-lg font-medium text-white',
              'bg-primary dark:bg-primary-dark',
              'hover:bg-primary-hover dark:hover:bg-primary-dark-hover'
            )}
          >
            Back to Workspaces
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className={cn(
        'flex items-center justify-between px-6 py-4 flex-shrink-0',
        'bg-surface-light dark:bg-surface-dark',
        'border-b border-border-DEFAULT dark:border-border-dark'
      )}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/workspaces')}
            className={cn(
              'p-2 rounded-lg transition-colors',
              'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark'
            )}
            title="Back to Workspaces"
          >
            <ArrowLeft className="w-5 h-5 text-text-main-DEFAULT dark:text-text-main-dark" />
          </button>

          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-primary dark:text-primary-dark" />
            <div>
              <h1 className="text-xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
                {workspace.name}
              </h1>
              <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                {workspace.db_type === DbType.SIMULATION ? 'Virtual Schema' : `${workspace.db_type} Database`}
              </p>
            </div>
          </div>
        </div>

        {/* Sync Indicator */}
        {isSyncing && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              Syncing schema...
            </span>
          </div>
        )}
      </header>

      {/* Main Content - 3 Pane IDE Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Pane A: Session Manager (Left Sidebar) */}
        <aside className={cn(
          'w-72 flex-shrink-0',
          'bg-surface-light dark:bg-surface-dark',
          'border-r border-border-DEFAULT dark:border-border-dark'
        )}>
          <SessionManager
            conversations={editorLogic.conversations.map(c => ({
              id: c.id,
              title: c.title,
              created_at: c.created_at,
              updated_at: c.created_at,
            }))}
            activeConversationId={editorLogic.activeConversationId}
            onSelectConversation={editorLogic.handleSelectConversation}
            onNewChat={editorLogic.handleNewChat}
          />
        </aside>

        {/* Pane B: Chat Workbench (Center) */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className={cn(
            'flex-1 flex flex-col overflow-hidden',
            activeResultSql && !isResultsCollapsed && 'min-h-0'
          )}>
            <ChatArea
              messages={editorLogic.messages}
              onSendMessage={handleSendMessage}
              onRunQuery={handleRunQuery}
              onOptimize={handleOptimize}
              onExplain={handleExplain}
              inputValue={inputValue}
              onUpdateInput={setInputValue}
              isLoading={editorLogic.isSendingMessage}
              isExecuting={editorLogic.isExecuting}
            />
          </div>

          {/* Results Panel (Resizable & Collapsible) - Always visible */}
          <div
            className={cn(
              'border-t border-border-DEFAULT dark:border-border-dark',
              'bg-surface-light dark:bg-surface-dark',
              'flex flex-col flex-shrink-0'
            )}
            style={{ height: isResultsCollapsed ? 'auto' : `${resultsPanelHeight}px` }}
          >
            {/* Resize Handle */}
            {!isResultsCollapsed && (
              <div
                className={cn(
                  'h-1 cursor-ns-resize hover:bg-primary dark:hover:bg-primary-dark transition-colors',
                  isResizing && 'bg-primary dark:bg-primary-dark'
                )}
                onMouseDown={() => setIsResizing(true)}
              />
            )}

            {/* Header */}
            <button
              onClick={() => setIsResultsCollapsed(!isResultsCollapsed)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-2',
                'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark',
                'transition-colors'
              )}
            >
              <span className="text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark flex items-center gap-2">
                Query Results
                {editorLogic.isExecuting && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {!activeResultSql && !editorLogic.isExecuting && (
                  <span className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
                    (No results yet)
                  </span>
                )}
              </span>
              {isResultsCollapsed ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

              {/* Results Content */}
              {!isResultsCollapsed && (
                <div className="flex-1 p-4 overflow-auto">
                  {editorLogic.isExecuting ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                      <Loader2 className="w-12 h-12 animate-spin text-primary dark:text-primary-dark" />
                      <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                        Executing query on database...
                      </p>
                    </div>
                  ) : !activeResultSql ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                      <div className="text-center py-8">
                        <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                          No results yet
                        </p>
                        <p className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">
                          Execute a query to see results
                        </p>
                      </div>
                    </div>
                  ) : editorLogic.executeError ? (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                            Query Execution Failed
                          </h4>
                          <div className="text-sm text-red-700 dark:text-red-400 font-mono whitespace-pre-wrap break-words">
                            {extractErrorMessage(editorLogic.executeError)}
                          </div>
                          
                          {/* Show SQL suggestion for common errors */}
                          {(() => {
                            const suggestion = getSQLErrorSuggestion(editorLogic.executeError);
                            if (!suggestion) return null;
                            
                            return (
                              <div className="mt-3 p-3 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">
                                  {suggestion.title}
                                </p>
                                <p className="text-xs text-blue-700 dark:text-blue-400 mb-2">
                                  {suggestion.description}
                                </p>
                                <pre className="text-xs bg-white dark:bg-gray-900 p-2 rounded border border-blue-200 dark:border-blue-700 overflow-x-auto">
                                  {suggestion.example}
                                </pre>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ) : editorLogic.queryResults.get(activeResultSql) ? (
                    <div>
                      {/* Truncation Warning */}
                      {editorLogic.queryResults.get(activeResultSql)?.data.truncated && (
                        <div className="mb-3 flex items-start gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
                              Result Set Truncated
                            </h4>
                            <p className="text-xs text-yellow-700 dark:text-yellow-400">
                              Showing {editorLogic.queryResults.get(activeResultSql)?.data.row_count.toLocaleString()} of{' '}
                              {editorLogic.queryResults.get(activeResultSql)?.data.total_rows.toLocaleString()} total rows
                              (limited to {editorLogic.queryResults.get(activeResultSql)?.data.max_rows.toLocaleString()} rows to prevent UI freeze).
                              Consider adding LIMIT clause to your query.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="mb-2 text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
                        Execution time: {editorLogic.queryResults.get(activeResultSql)?.data.execution_time_ms.toFixed(2)}ms
                        {' | '}
                        Rows: {editorLogic.queryResults.get(activeResultSql)?.data.row_count.toLocaleString()}
                        {editorLogic.queryResults.get(activeResultSql)?.data.truncated && (
                          <span className="text-yellow-600 dark:text-yellow-400">
                            {' '}(of {editorLogic.queryResults.get(activeResultSql)?.data.total_rows.toLocaleString()} total)
                          </span>
                        )}
                      </div>

                      {editorLogic.queryResults.get(activeResultSql)?.data.columns.length! > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm border border-border-DEFAULT dark:border-border-dark">
                            <thead className="bg-surface-highlight-light dark:bg-surface-highlight-dark">
                              <tr>
                                {editorLogic.queryResults.get(activeResultSql)?.data.columns.map((col) => (
                                  <th
                                    key={col}
                                    className="px-4 py-2 text-left font-medium text-text-main-DEFAULT dark:text-text-main-dark border-b border-border-DEFAULT dark:border-border-dark"
                                  >
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {editorLogic.queryResults.get(activeResultSql)?.data.rows.map((row, idx) => (
                                <tr
                                  key={idx}
                                  className="hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark"
                                >
                                  {editorLogic.queryResults.get(activeResultSql)?.data.columns.map((col) => (
                                    <td
                                      key={col}
                                      className="px-4 py-2 text-text-main-DEFAULT dark:text-text-main-dark border-b border-border-DEFAULT dark:border-border-dark"
                                    >
                                      {row[col] !== null ? String(row[col]) : <span className="text-text-muted-DEFAULT dark:text-text-muted-dark italic">null</span>}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                          Query executed successfully (no rows returned)
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                      No results yet
                    </div>
                  )}
                </div>
              )}
            </div>
        </main>

        {/* Pane C: Context Explorer (Right Sidebar) */}
        <aside className={cn(
          'w-90 flex-shrink-0',
          'bg-surface-light dark:bg-surface-dark',
          'border-l border-border-DEFAULT dark:border-border-dark'
        )}>
          <SchemaViewer schema={workspace.meta_schema} workspaceId={workspace.id} />
        </aside>
      </div>

      {/* Optimization Modal */}
      <OptimizationModal
        isOpen={editorLogic.isOptimizationModalOpen}
        onClose={editorLogic.handleCloseOptimizationModal}
        analysis={editorLogic.optimizationResult ? {
          original_cost: editorLogic.optimizationResult.stats_comparison?.old_cost || null,
          bottlenecks: [], // TODO: extract from explanation or add to backend response
          optimized_sql: editorLogic.optimizationResult.optimized_sql,
          index_recommendation: editorLogic.optimizationResult.index_recommendation,
          explanation: editorLogic.optimizationResult.explanation,
          stats_comparison: editorLogic.optimizationResult.stats_comparison,
        } : null}
        originalSql={editorLogic.optimizationResult?.original_sql || ''}
        isAnalyzing={editorLogic.isOptimizing}
        isApplying={false}
        onReplaceQuery={(sql: string) => {
          // sql already contains the full script (index + optimized SQL) from OptimizationModal
          // Display the script in chat as assistant message
          editorLogic.handleApplyOptimization(sql);

          // Auto-run the script
          handleRunQuery(sql);
        }}
      />
    </div>
  );
}
