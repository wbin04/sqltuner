/**
 * ChatArea Component (Pane B - Center)
 * Main workbench with chat stream, SQL blocks, and action bar
 */
import { useState } from 'react';
import { Send, Sparkles, Play, LineChart } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql_generated?: string;
  created_at: string;
}

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  onRunQuery: (sql: string) => void;
  onOptimize: (sql: string) => void;
  onExplain: (sql: string) => void;
  isSending?: boolean;
}

export function ChatArea({
  messages,
  onSendMessage,
  onRunQuery,
  onOptimize,
  onExplain,
  isSending = false,
}: ChatAreaProps) {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isSending) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6">
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
                  'bg-surface-DEFAULT dark:bg-surface-dark',
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
                  'bg-surface-DEFAULT dark:bg-surface-dark',
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
            {messages.map((message) => (
              <div key={message.id} className="space-y-3">
                {/* Message Content */}
                <div className={cn(
                  'flex gap-4',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}>
                  <div className={cn(
                    'max-w-3xl rounded-xl px-4 py-3',
                    message.role === 'user'
                      ? 'bg-primary dark:bg-primary-dark text-white'
                      : 'bg-surface-DEFAULT dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark'
                  )}>
                    <p className={cn(
                      'text-sm whitespace-pre-wrap',
                      message.role === 'assistant' && 'text-text-main-DEFAULT dark:text-text-main-dark'
                    )}>
                      {message.content}
                    </p>
                  </div>
                </div>

                {/* SQL Block with Action Bar */}
                {message.sql_generated && (
                  <div className={cn(
                    'max-w-3xl rounded-xl overflow-hidden',
                    'bg-surface-DEFAULT dark:bg-surface-dark',
                    'border border-border-DEFAULT dark:border-border-dark'
                  )}>
                    {/* SQL Code */}
                    <pre className="p-4 overflow-x-auto">
                      <code className="text-sm font-mono text-text-main-DEFAULT dark:text-text-main-dark">
                        {message.sql_generated}
                      </code>
                    </pre>

                    {/* Action Bar */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark border-t border-border-DEFAULT dark:border-border-dark">
                      <button
                        onClick={() => onRunQuery(message.sql_generated!)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                          'bg-green-600 dark:bg-green-600 text-white',
                          'hover:bg-green-700 dark:hover:bg-green-700'
                        )}
                      >
                        <Play className="w-4 h-4" />
                        Run Query
                      </button>
                      <button
                        onClick={() => onExplain(message.sql_generated!)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                          'bg-surface-DEFAULT dark:bg-surface-dark',
                          'border border-border-DEFAULT dark:border-border-dark',
                          'hover:bg-surface-highlight-DEFAULT dark:hover:bg-surface-highlight-dark'
                        )}
                      >
                        <LineChart className="w-4 h-4" />
                        Explain
                      </button>
                      <button
                        onClick={() => onOptimize(message.sql_generated!)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                          'bg-gradient-to-r from-primary to-secondary dark:from-primary-dark dark:to-secondary-dark',
                          'text-white',
                          'hover:shadow-lg'
                        )}
                      >
                        <Sparkles className="w-4 h-4" />
                        Optimize
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className={cn(
        'border-t border-border-DEFAULT dark:border-border-dark',
        'bg-surface-DEFAULT dark:bg-surface-dark',
        'p-4'
      )}>
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask me anything about your database..."
              className={cn(
                'flex-1 px-4 py-3 rounded-lg resize-none',
                'bg-background-DEFAULT dark:bg-background-dark',
                'border border-border-DEFAULT dark:border-border-dark',
                'text-text-main-DEFAULT dark:text-text-main-dark',
                'placeholder:text-text-muted-DEFAULT dark:placeholder:text-text-muted-dark',
                'focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary-dark/50'
              )}
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isSending}
              className={cn(
                'px-6 py-3 rounded-lg font-medium text-white flex items-center gap-2',
                'bg-primary dark:bg-primary-dark',
                'hover:bg-primary-hover dark:hover:bg-primary-dark-hover',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors'
              )}
            >
              <Send className="w-5 h-5" />
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
