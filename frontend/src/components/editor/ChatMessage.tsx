import { User, Bot } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { QueryLog } from '../../types';
import { SQLBlock } from './SQLBlock';
import { FeedbackPanel } from '../feedback/FeedbackPanel';

interface ChatMessageProps {
  message: QueryLog;
  onExplain?: (sql: string) => void;
  onOptimize?: (sql: string) => void;
  onExecute?: (sql: string) => void;
  onFeedback?: (queryLogId: string, rating: 0 | 1, correctedSql?: string, comment?: string) => void;
  isExecuting?: boolean;
  isExplaining?: boolean;
  isOptimizing?: boolean;
}

export function ChatMessage({ 
  message, 
  onExplain, 
  onOptimize, 
  onExecute,
  onFeedback,
  isExecuting = false,
  isExplaining = false,
  isOptimizing = false
}: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn(
      'flex gap-4 p-4',
      isUser ? 'bg-transparent' : 'bg-surface dark:bg-surface-dark'
    )}>
      {/* Avatar */}
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
        isUser 
          ? 'bg-gradient-to-br from-secondary to-purple-600' 
          : 'bg-gradient-to-br from-primary to-blue-600'
      )}>
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Bot className="w-5 h-5 text-white" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3">
        {/* Role Label */}
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-sm font-medium',
            isUser ? 'text-secondary dark:text-secondary-dark' : 'text-primary dark:text-primary-dark'
          )}>
            {isUser ? 'You' : 'AI Assistant'}
          </span>
          <span className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
            {new Date(message.createdAt).toLocaleTimeString()}
          </span>
        </div>

        {/* Text Content */}
        <div className="text-text-main-DEFAULT dark:text-text-main-dark prose prose-invert max-w-none">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* SQL Block (if generated) */}
        {message.sql_generated && (
          <SQLBlock
            sql={message.sql_generated}
            queryLogId={message.id}
            onExplain={onExplain}
            onOptimize={onOptimize}
            onExecute={onExecute}
            isExecuting={isExecuting}
            isExplaining={isExplaining}
            isOptimizing={isOptimizing}
          />
        )}

        {/* Feedback (for AI messages only) */}
        {!isUser && onFeedback && (
          <FeedbackPanel
            queryLogId={message.id}
            onSubmitFeedback={onFeedback}
          />
        )}
      </div>
    </div>
  );
}
