/**
 * SessionManager Component (Pane A - Left Sidebar)
 * Manages conversation sessions for the current workspace
 */
import { Plus, MessageSquare, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface SessionManagerProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  isLoading?: boolean;
}

export function SessionManager({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  isLoading = false,
}: SessionManagerProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border-DEFAULT dark:border-border-dark">
        <button
          onClick={onNewChat}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium',
            'bg-primary dark:bg-primary-dark text-white',
            'hover:bg-primary-hover dark:hover:bg-primary-dark-hover',
            'transition-colors'
          )}
        >
          <Plus className="w-5 h-5" />
          New Chat
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2">
        <h3 className="px-3 py-2 text-xs font-semibold text-text-muted-DEFAULT dark:text-text-muted-dark uppercase tracking-wider">
          Sessions
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
              Loading sessions...
            </div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <MessageSquare className="w-12 h-12 text-text-muted-DEFAULT dark:text-text-muted-dark mb-3 opacity-50" />
            <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
              No conversations yet. Start a new chat!
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;

              return (
                <button
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  className={cn(
                    'w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left transition-all',
                    'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark',
                    isActive && 'bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark border border-primary/30 dark:border-primary-dark/30'
                  )}
                >
                  <MessageSquare className={cn(
                    'w-4 h-4 flex-shrink-0 mt-0.5',
                    isActive ? 'text-primary dark:text-primary-dark' : 'text-text-muted-DEFAULT dark:text-text-muted-dark'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-medium truncate',
                      isActive ? 'text-text-main-DEFAULT dark:text-text-main-dark' : 'text-text-main-DEFAULT dark:text-text-main-dark'
                    )}>
                      {conversation.title}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Calendar className="w-3 h-3 text-text-muted-DEFAULT dark:text-text-muted-dark" />
                      <span className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
                        {format(new Date(conversation.updated_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
