/**
 * EditorPage
 * Main SQL editor with 3-pane IDE layout
 * Pane A: Session Manager (Left) | Pane B: Chat Workbench (Center) | Pane C: Schema Viewer (Right)
 * Implements auto-sync logic for real databases with empty schema
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Database, Loader2, AlertCircle, RefreshCw, ArrowLeft, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useWorkspace } from '../hooks/useWorkspace';
import { SchemaViewer } from '../components/editor/SchemaViewer';
import { SessionManager } from '../components/editor/SessionManager';
import { ChatArea } from '../components/editor/ChatArea';
import { OptimizationModal } from '../components/editor/OptimizationModal';
import { DbType } from '../types/workspace';

// Mock data - to be replaced with real API calls
const mockConversations = [
  { id: '1', title: 'User analytics query', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', title: 'Performance optimization', created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString() },
];

const mockMessages = [
  {
    id: '1',
    role: 'user' as const,
    content: 'Show me all users who registered in the last 7 days',
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    role: 'assistant' as const,
    content: 'I\'ll help you query users who registered in the last 7 days. Here\'s the SQL query:',
    sql_generated: 'SELECT id, email, username, created_at\nFROM users\nWHERE created_at >= NOW() - INTERVAL \'7 days\'\nORDER BY created_at DESC;',
    created_at: new Date().toISOString(),
  },
];

export function EditorPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [autoSyncTriggered, setAutoSyncTriggered] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>('1');
  const [isOptimizationModalOpen, setIsOptimizationModalOpen] = useState(false);
  const [currentOptimization, setCurrentOptimization] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);

  if (!workspaceId) {
    navigate('/workspaces');
    return null;
  }

  const { workspace, isLoading, isError, error, syncSchema, isSyncing } = useWorkspace(workspaceId);

  // Handlers
  const handleNewChat = () => {
    console.log('Creating new chat...');
    // TODO: Implement new chat creation
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
  };

  const handleSendMessage = (content: string) => {
    console.log('Sending message:', content);
    // TODO: Implement message sending
  };

  const handleRunQuery = (sql: string) => {
    console.log('Running query:', sql);
    setShowResults(true);
    // TODO: Implement query execution
  };

  const handleOptimize = (sql: string) => {
    console.log('Optimizing query:', sql);
    // Mock optimization result
    setCurrentOptimization({
      original_sql: sql,
      optimized_sql: sql.replace('SELECT *', 'SELECT id, email, username, created_at'),
      cost_reduction: 45,
      execution_time_improvement: 2.3,
      explanation: 'Replaced SELECT * with specific columns to reduce data transfer and improve query performance.',
      index_recommendations: [
        'CREATE INDEX idx_users_created_at ON users(created_at DESC);',
        'CREATE INDEX idx_users_email ON users(email);'
      ],
    });
    setIsOptimizationModalOpen(true);
  };

  const handleExplain = (sql: string) => {
    console.log('Explaining query:', sql);
    // TODO: Implement query explanation
  };

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
      <div className="min-h-screen bg-background-DEFAULT dark:bg-background-dark flex items-center justify-center">
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
      <div className="min-h-screen bg-background-DEFAULT dark:bg-background-dark flex items-center justify-center">
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
    <div className="h-screen flex flex-col bg-background-DEFAULT dark:bg-background-dark">
      {/* Header */}
      <header className={cn(
        'flex items-center justify-between px-6 py-4 flex-shrink-0',
        'bg-surface-DEFAULT dark:bg-surface-dark',
        'border-b border-border-DEFAULT dark:border-border-dark'
      )}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/workspaces')}
            className={cn(
              'p-2 rounded-lg transition-colors',
              'hover:bg-surface-highlight-DEFAULT dark:hover:bg-surface-highlight-dark'
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
          'bg-surface-DEFAULT dark:bg-surface-dark',
          'border-r border-border-DEFAULT dark:border-border-dark'
        )}>
          <SessionManager
            conversations={mockConversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onNewChat={handleNewChat}
          />
        </aside>

        {/* Pane B: Chat Workbench (Center) */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <ChatArea
            messages={mockMessages}
            onSendMessage={handleSendMessage}
            onRunQuery={handleRunQuery}
            onOptimize={handleOptimize}
            onExplain={handleExplain}
          />

          {/* Results Panel (Collapsible) */}
          {showResults && (
            <div className={cn(
              'border-t border-border-DEFAULT dark:border-border-dark',
              'bg-surface-DEFAULT dark:bg-surface-dark'
            )}>
              <button
                onClick={() => setShowResults(false)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-2',
                  'hover:bg-surface-highlight-DEFAULT dark:hover:bg-surface-highlight-dark',
                  'transition-colors'
                )}
              >
                <span className="text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark">
                  Query Results
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>
              <div className="p-4 max-h-64 overflow-auto">
                <div className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                  Results will appear here...
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Pane C: Context Explorer (Right Sidebar) */}
        <aside className={cn(
          'w-80 flex-shrink-0',
          'bg-surface-DEFAULT dark:bg-surface-dark',
          'border-l border-border-DEFAULT dark:border-border-dark'
        )}>
          <SchemaViewer schema={workspace.meta_schema} />
        </aside>
      </div>

      {/* Optimization Modal */}
      <OptimizationModal
        isOpen={isOptimizationModalOpen}
        onClose={() => setIsOptimizationModalOpen(false)}
        result={currentOptimization}
        onApply={(sql) => {
          console.log('Applying optimized SQL:', sql);
          // TODO: Apply optimized SQL to chat
        }}
      />
    </div>
  );
}
