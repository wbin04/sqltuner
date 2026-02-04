import { useState } from 'react';
import { Database, FileText, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { ConversationSidebar } from '../components/editor/ConversationSidebar';
import { ChatMessage } from '../components/editor/ChatMessage';
import { ChatInput } from '../components/editor/ChatInput';
import { SchemaTree } from '../components/editor/SchemaTree';
import { ResultsGrid } from '../components/editor/ResultsGrid';
import { PerformanceModal } from '../components/performance/PerformanceModal';
import type { Conversation, QueryLog, TableSchema, QueryResult, PerformanceAnalysis } from '../types';

// Mock Data
const mockConversations: Conversation[] = [
  {
    id: '1',
    connection_id: 'conn-1',
    title: 'User analytics query',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    connection_id: 'conn-1',
    title: 'Performance optimization',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: '3',
    connection_id: 'conn-1',
    title: 'Join tables example',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 172800000).toISOString()
  },
];

const mockMessages: QueryLog[] = [
  {
    id: '1',
    conversation_id: '1',
    role: 'user',
    content: 'Show me all users who registered in the last 7 days',
    createdAt: new Date(Date.now() - 300000).toISOString()
  },
  {
    id: '2',
    conversation_id: '1',
    role: 'assistant',
    content: 'I\'ll help you query users who registered in the last 7 days. Here\'s the SQL query:',
    sql_generated: `SELECT id, email, username, created_at\nFROM users\nWHERE created_at >= NOW() - INTERVAL '7 days'\nORDER BY created_at DESC;`,
    createdAt: new Date(Date.now() - 290000).toISOString()
  }
];

const mockSchema: TableSchema[] = [
  {
    table_name: 'users',
    row_count: 15420,
    columns: [
      { column_name: 'id', data_type: 'integer', is_nullable: false, is_primary_key: true },
      { column_name: 'email', data_type: 'varchar(255)', is_nullable: false },
      { column_name: 'username', data_type: 'varchar(100)', is_nullable: false },
      { column_name: 'password', data_type: 'varchar(255)', is_nullable: false },
      { column_name: 'created_at', data_type: 'timestamp', is_nullable: false },
    ],
    indexes: [
      { index_name: 'users_pkey', columns: ['id'], is_unique: true, index_type: 'btree' },
      { index_name: 'users_email_idx', columns: ['email'], is_unique: true, index_type: 'btree' },
    ]
  },
  {
    table_name: 'db_connections',
    row_count: 23,
    columns: [
      { column_name: 'id', data_type: 'integer', is_nullable: false, is_primary_key: true },
      { column_name: 'name', data_type: 'varchar(255)', is_nullable: false },
      { column_name: 'host', data_type: 'varchar(255)', is_nullable: false },
      { column_name: 'port', data_type: 'integer', is_nullable: false },
      { column_name: 'db_type', data_type: 'varchar(50)', is_nullable: false },
    ]
  },
  {
    table_name: 'conversations',
    row_count: 156,
    columns: [
      { column_name: 'id', data_type: 'integer', is_nullable: false, is_primary_key: true },
      { column_name: 'connection_id', data_type: 'integer', is_nullable: false, is_foreign_key: true },
      { column_name: 'title', data_type: 'varchar(255)', is_nullable: false },
      { column_name: 'created_at', data_type: 'timestamp', is_nullable: false },
    ]
  }
];

export function QueryEditor() {
  const [activeConversation, setActiveConversation] = useState<string>('1');
  const [messages, setMessages] = useState<QueryLog[]>(mockMessages);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<'schema' | 'results'>('schema');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [performanceAnalysis, setPerformanceAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);

  const handleSendMessage = (content: string) => {
    const newMessage: QueryLog = {
      id: Date.now().toString(),
      conversation_id: activeConversation,
      role: 'user',
      content,
      createdAt: new Date().toISOString()
    };
    setMessages([...messages, newMessage]);

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: QueryLog = {
        id: (Date.now() + 1).toString(),
        conversation_id: activeConversation,
        role: 'assistant',
        content: 'I understand your request. Here\'s a SQL query to help:',
        sql_generated: `-- Generated query based on your request\nSELECT * FROM users LIMIT 10;`,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
  };

  const handleExecuteQuery = (sql: string) => {
    console.log('Executing SQL:', sql);
    setIsExecuting(true);
    setRightPanelTab('results');
    setIsRightPanelOpen(true);

    // Simulate query execution
    setTimeout(() => {
      const mockResult: QueryResult = {
        columns: ['id', 'email', 'username', 'created_at'],
        rows: [
          { id: 1, email: 'user1@example.com', username: 'user1', created_at: '2026-01-10 10:30:00' },
          { id: 2, email: 'user2@example.com', username: 'user2', created_at: '2026-01-11 14:20:00' },
          { id: 3, email: 'user3@example.com', username: 'user3', created_at: '2026-01-12 09:15:00' },
        ],
        rowCount: 3,
        executionTime: 45
      };
      setQueryResult(mockResult);
      setIsExecuting(false);
    }, 1500);
  };

  const handleExplain = (sql: string) => {
    console.log('Explain query:', sql);
    setIsExplaining(true);
    
    // Mock performance analysis
    setTimeout(() => {
      const mockAnalysis: PerformanceAnalysis = {
        id: 'perf-1',
        query_log_id: 'temp-id',
        execution_time_ms: 850,
        total_cost: 125.45,
        explain_plan: {
          'Node Type': 'Seq Scan',
          'Startup Cost': 0,
          'Total Cost': 125.45,
          'Plan Rows': 15420,
          'Plan Width': 256,
          'Actual Rows': 15420,
          'Actual Loops': 1,
          'Relation Name': 'users',
          Plans: []
        },
        index_recommendation: 'CREATE INDEX idx_users_created_at ON users(created_at);',
        createdAt: new Date().toISOString()
      };
      
      setPerformanceAnalysis(mockAnalysis);
      setIsPerformanceModalOpen(true);
      setIsExplaining(false);
    }, 1500);
  };

  const handleOptimize = (sql: string) => {
    console.log('Optimize query:', sql);
    setIsOptimizing(true);
    
    // Simulate optimization process
    setTimeout(() => {
      // TODO: Trigger optimization with the actual SQL
      setIsOptimizing(false);
    }, 1500);
  };

  const handleFeedback = (queryLogId: string, rating: 0 | 1, correctedSql?: string, comment?: string) => {
    console.log('Feedback:', { queryLogId, rating, correctedSql, comment });
    // TODO: Save feedback to backend
  };

  return (
    <div className="h-screen flex bg-background dark:bg-background-dark">
      {/* Left Sidebar - Conversations */}
      <ConversationSidebar
        conversations={mockConversations}
        activeConversationId={activeConversation}
        onSelectConversation={setActiveConversation}
        onNewConversation={() => console.log('New conversation')}
      />

      {/* Center - Chat */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-border dark:border-border-dark bg-surface dark:bg-surface-dark">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark">
                {mockConversations.find(c => c.id === activeConversation)?.title}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Database className="w-4 h-4 text-primary dark:text-primary-dark" />
                <span className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                  Production DB • postgres://localhost:5432/sqltuner
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
              className="p-2 rounded-lg hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark text-text-muted-DEFAULT dark:text-text-muted-dark hover:text-text-main-DEFAULT dark:hover:text-text-main-dark transition-colors"
            >
              {isRightPanelOpen ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.map(message => (
            <ChatMessage
              key={message.id}
              message={message}
              onExplain={handleExplain}
              onOptimize={handleOptimize}
              onExecute={handleExecuteQuery}
              onFeedback={handleFeedback}
              isExecuting={isExecuting}
              isExplaining={isExplaining}
              isOptimizing={isOptimizing}
            />
          ))}
        </div>

        {/* Input */}
        <ChatInput onSend={handleSendMessage} />
      </div>

      {/* Right Panel - Schema & Results */}
      {isRightPanelOpen && (
        <div className="w-96 bg-surface dark:bg-surface-dark border-l border-border dark:border-border-dark flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-border dark:border-border-dark">
            <button
              onClick={() => setRightPanelTab('schema')}
              className={cn(
                'flex-1 px-4 py-3 text-sm font-medium transition-colors',
                rightPanelTab === 'schema'
                  ? 'text-primary dark:text-primary-dark border-b-2 border-primary dark:border-primary-dark bg-background dark:bg-background-dark'
                  : 'text-text-muted-DEFAULT dark:text-text-muted-dark hover:text-text-main-DEFAULT dark:hover:text-text-main-dark hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark'
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Database className="w-4 h-4" />
                <span>Schema</span>
              </div>
            </button>
            <button
              onClick={() => setRightPanelTab('results')}
              className={cn(
                'flex-1 px-4 py-3 text-sm font-medium transition-colors',
                rightPanelTab === 'results'
                  ? 'text-primary dark:text-primary-dark border-b-2 border-primary dark:border-primary-dark bg-background dark:bg-background-dark'
                  : 'text-text-muted-DEFAULT dark:text-text-muted-dark hover:text-text-main-DEFAULT dark:hover:text-text-main-dark hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark'
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Results</span>
              </div>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {rightPanelTab === 'schema' ? (
              <SchemaTree tables={mockSchema} />
            ) : (
              <ResultsGrid result={queryResult} loading={isExecuting} />
            )}
          </div>
        </div>
      )}

      {/* Performance Modal */}
      {performanceAnalysis && (
        <PerformanceModal
          analysis={performanceAnalysis}
          isOpen={isPerformanceModalOpen}
          onClose={() => setIsPerformanceModalOpen(false)}
        />
      )}
    </div>
  );
}
