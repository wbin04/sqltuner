/**
 * ChatArea Component (Pane B - Center)
 * Main workbench with chat stream, SQL blocks, and action bar
 */
import { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SchemaGeneratedData } from '../../services/chatService';
import { SchemaBlock } from './SchemaBlock';
import { ClarificationBlock } from './ClarificationBlock';
import { format } from 'date-fns';
import { SQLBlock } from './SQLBlock';

const CLARIFICATION_MARKER = 'Before designing the schema, I have a few questions:';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql_generated?: string;
  schema_generated?: SchemaGeneratedData | null;
  is_schema_design?: boolean;
  created_at: string;
}

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (content: string, mode?: 'chat' | 'check' | 'gen' | 'fix', error_message?: string, original_sql?: string) => void;
  onExecute: (sql: string) => void;
  onOptimize: (sql: string) => void;
  onExplain: (sql: string) => void;
  onApplySchemaToSandbox?: (schema: SchemaGeneratedData) => void;
  isSimulationWorkspace?: boolean;
  pendingClarification?: {
    questions: Array<{ q: string; options?: string[] }>;
    originalMessage: string;
  } | null;
  onSubmitClarification?: (answers: Array<{ q: string; answer: string }>) => void;
  inputValue?: string;
  onUpdateInput?: (value: string) => void;
  isLoading?: boolean;
  isExecuting?: boolean;
  isExplaining?: boolean;
  isOptimizing?: boolean;
}

export function ChatArea({
  messages,
  onSendMessage,
  onExecute,
  onOptimize,
  onExplain,
  onApplySchemaToSandbox,
  isSimulationWorkspace = false,
  pendingClarification,
  onSubmitClarification,
  inputValue: externalInputValue,
  onUpdateInput,
  isLoading = false,
  isExecuting = false,
  isExplaining = false,
  isOptimizing = false,
}: ChatAreaProps) {
  const [internalInputValue, setInternalInputValue] = useState('');
  const [chatMode, setChatMode] = useState<'chat' | 'check' | 'gen' | 'fix'>('chat');
  const [errorInput, setErrorInput] = useState('');
  const handleExplainAction = (_messageId: string, sql: string) => {
    if (onExplain) onExplain(sql);
  };

  // Use external input value if provided, otherwise use internal
  const inputValue = externalInputValue !== undefined ? externalInputValue : internalInputValue;
  const setInputValue = onUpdateInput || setInternalInputValue;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom when new messages arrive or loading state updates
  const lastMessage = messages[messages.length - 1];
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, lastMessage?.id, lastMessage?.content]);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height to scrollHeight, but limit to max height
      const maxHeight = 200; // Maximum height in pixels (about 8-10 lines)
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px';

      // Add overflow if content exceeds max height
      textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [inputValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      if (chatMode === 'fix') {
        const lastSql = [...messages].reverse().find(m => m.sql_generated)?.sql_generated;
        onSendMessage(inputValue.trim(), 'fix', errorInput.trim() || undefined, lastSql);
        setErrorInput('');
      } else {
        onSendMessage(inputValue.trim(), chatMode);
      }
      setInputValue('');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-surface dark:bg-background-dark">
        {messages.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center mb-6',
              'bg-gradient-to-br from-primary/10 to-secondary/10 dark:from-primary-dark/10 dark:to-secondary-dark/10'
            )}>
              <Sparkles className="w-10 h-10 text-primary dark:text-primary-dark" />
            </div>
            <h2 className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark mb-2">
              AI-Powered SQL Assistant
            </h2>
            <p className="text-text-muted-DEFAULT dark:text-text-muted-dark max-w-md mb-6">
              Ask questions in natural language. I'll generate optimized SQL queries, explain performance, and suggest improvements.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-2xl">
              <button
                onClick={() => setInputValue('Show me all users registered in the last 7 days')}
                className={cn(
                  'px-4 py-3 rounded-lg text-left text-sm transition-all',
                  'bg-surface-light dark:bg-surface-dark',
                  'border border-border-DEFAULT dark:border-border-dark',
                  'hover:border-primary/50 dark:hover:border-primary-dark/50',
                  'hover:shadow-md'
                )}
              >
                <p className="font-medium text-text-main-DEFAULT dark:text-text-main-dark mb-1">
                  Recent Users
                </p>
                <p className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
                  Find users who joined recently
                </p>
              </button>
              <button
                onClick={() => setInputValue('Why is this query slow?')}
                className={cn(
                  'px-4 py-3 rounded-lg text-left text-sm transition-all',
                  'bg-surface-light dark:bg-surface-dark',
                  'border border-border-DEFAULT dark:border-border-dark',
                  'hover:border-primary/50 dark:hover:border-primary-dark/50',
                  'hover:shadow-md'
                )}
              >
                <p className="font-medium text-text-main-DEFAULT dark:text-text-main-dark mb-1">
                  Performance Analysis
                </p>
                <p className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
                  Analyze query performance
                </p>
              </button>
            </div>
          </div>
        ) : (
          // Messages
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.map((message) => {
              const isClarificationMessage =
                message.role === 'assistant' &&
                message.content.includes(CLARIFICATION_MARKER);

              return (
                <div key={message.id} className="space-y-3">
                  {/* Normal message — hidden when it's a clarification */}
                  {!isClarificationMessage && (
                    <div className={cn(
                      'flex gap-2 items-end',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}>
                      <div className={cn(
                        'max-w-3xl rounded-xl px-4 py-3',
                        message.role === 'user'
                          ? 'bg-primary dark:bg-primary-dark text-white'
                          : 'bg-surface-light dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark'
                      )}>
                        {message.content === 'Processing...' && message.role === 'assistant' ? (
                          <div className="flex items-center gap-3">
                            <Loader2 className="w-4 h-4 animate-spin text-primary dark:text-primary-dark" />
                            <p className="text-sm text-text-main-DEFAULT dark:text-text-main-dark">
                              Processing your request...
                            </p>
                          </div>
                        ) : (
                          <p className={cn(
                            'text-sm whitespace-pre-wrap',
                            message.role === 'assistant' && 'text-text-main-DEFAULT dark:text-text-main-dark'
                          )}>
                            {message.content}
                          </p>
                        )}
                      </div>

                      {/* Timestamp Column on the right */}
                      <div className="text-[11px] text-text-muted-DEFAULT dark:text-text-muted-dark opacity-60 mb-2 whitespace-nowrap flex-shrink-0">
                        {format(new Date(message.created_at), 'HH:mm:ss')}
                      </div>
                    </div>
                  )}

                  {/* Interactive ClarificationBlock — active pending */}
                  {isClarificationMessage && pendingClarification && (
                    <div className="max-w-3xl">
                      <ClarificationBlock
                        questions={pendingClarification.questions}
                        onSubmit={onSubmitClarification || (() => { })}
                        isLoading={isLoading}
                      />
                    </div>
                  )}

                  {/* Answered clarification — compact badge */}
                  {isClarificationMessage && !pendingClarification && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                        <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                        <span className="text-xs text-purple-600 dark:text-purple-400">
                          Schema questions answered — schema generated below
                        </span>
                      </div>
                    </div>
                  )}

                  {/* SQL Block with Action Bar */}
                  {message.sql_generated && (
                    <div className="max-w-3xl">
                      <SQLBlock
                        sql={message.sql_generated}
                        queryLogId={message.id}
                        onExecute={onExecute}
                        onExplain={(sql) => handleExplainAction(message.id, sql)}
                        onOptimize={onOptimize}
                        isExecuting={isExecuting}
                        isExplaining={isExplaining}
                        isOptimizing={isOptimizing}
                      />

                      {/* Explain Block display removed — shown as global modal */}
                    </div>
                  )}

                  {message.schema_generated && (
                    <div className="max-w-3xl">
                      <SchemaBlock
                        schema={message.schema_generated}
                        onApplyToSandbox={onApplySchemaToSandbox || (() => { })}
                        isSimulationWorkspace={isSimulationWorkspace}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className={cn(
        'border-t border-border-DEFAULT dark:border-border-dark',
        'bg-surface-light dark:bg-surface-dark',
        'p-4'
      )}>
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end">
            <select
              value={chatMode}
              onChange={(e) => setChatMode(e.target.value as 'chat' | 'check' | 'gen' | 'fix')}
              title="Select chat mode"
              className={cn(
                'px-3 py-3 rounded-lg flex-shrink-0',
                'bg-background-light dark:bg-background-dark',
                'border border-border-DEFAULT dark:border-border-dark',
                'text-text-main-DEFAULT dark:text-text-main-dark',
                'focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary-dark/50',
                'h-[60px]'
              )}
            >
              <option value="chat">Chat</option>
              <option value="check">Check</option>
              <option value="gen">Gen</option>
              <option value="fix">Fix</option>
            </select>
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                chatMode === 'fix'
                  ? 'Describe the issue, or just send...'
                  : chatMode === 'gen'
                    ? 'Describe the database system you want to build...'
                    : chatMode === 'check'
                      ? 'Paste SQL to validate syntax...'
                      : 'Ask me anything about your database...'
              }
              className={cn(
                'flex-1 px-4 py-3 rounded-lg resize-none',
                'bg-background-light dark:bg-background-dark',
                'border border-border-DEFAULT dark:border-border-dark',
                'text-text-main-DEFAULT dark:text-text-main-dark',
                'placeholder:text-text-muted-DEFAULT dark:placeholder:text-text-muted-dark',
                'focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary-dark/50',
                'min-h-[60px] max-h-[200px]'
              )}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className={cn(
                'px-6 py-3 rounded-lg font-medium text-white flex items-center gap-2 flex-shrink-0',
                'bg-primary dark:bg-primary-dark',
                'hover:bg-primary-hover dark:hover:bg-primary-dark-hover',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors',
                'h-[60px]'
              )}
            >
              <Send className="w-5 h-5" />
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
