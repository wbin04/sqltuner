import { MessageSquare, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Conversation } from '../../types';

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation
}: ConversationSidebarProps) {
  // Group conversations by date
  const groupByDate = (convs: Conversation[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const groups: Record<string, Conversation[]> = {
      Today: [],
      Yesterday: [],
      'Last Week': [],
      Older: []
    };

    convs.forEach(conv => {
      const convDate = new Date(conv.createdAt);
      if (convDate >= today) {
        groups.Today.push(conv);
      } else if (convDate >= yesterday) {
        groups.Yesterday.push(conv);
      } else if (convDate >= lastWeek) {
        groups['Last Week'].push(conv);
      } else {
        groups.Older.push(conv);
      }
    });

    return groups;
  };

  const grouped = groupByDate(conversations);

  return (
    <div className="w-64 bg-surface dark:bg-surface-dark border-r border-border dark:border-border-dark flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border dark:border-border-dark">
        <button
          onClick={onNewConversation}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg',
            'bg-primary dark:bg-primary-dark hover:bg-primary-hover dark:hover:bg-primary-dark-hover text-white font-medium',
            'transition-all hover:shadow-lg hover:shadow-primary/20 dark:hover:shadow-primary-dark/20'
          )}
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {Object.entries(grouped).map(([label, convs]) => {
          if (convs.length === 0) return null;

          return (
            <div key={label} className="space-y-1">
              <div className="px-3 py-2 text-xs font-medium text-text-muted-DEFAULT dark:text-text-muted-dark uppercase tracking-wider">
                {label}
              </div>
              {convs.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg transition-all',
                    'hover:bg-surface-highlight-DEFAULT dark:hover:bg-surface-highlight-dark group',
                    activeConversationId === conv.id && 'bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark border border-primary/30 dark:border-primary-dark/30'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className={cn(
                      'w-4 h-4 mt-0.5 flex-shrink-0',
                      activeConversationId === conv.id ? 'text-primary dark:text-primary-dark' : 'text-text-muted-DEFAULT dark:text-text-muted-dark'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm font-medium truncate',
                        activeConversationId === conv.id ? 'text-text-main-DEFAULT dark:text-text-main-dark' : 'text-text-muted-DEFAULT dark:text-text-muted-dark'
                      )}>
                        {conv.title}
                      </p>
                      <p className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
                        {new Date(conv.updatedAt).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          );
        })}

        {conversations.length === 0 && (
          <div className="text-center py-8 px-4">
            <MessageSquare className="w-12 h-12 text-text-muted-DEFAULT dark:text-text-muted-dark mx-auto mb-3 opacity-50" />
            <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">No conversations yet</p>
            <p className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">Start a new chat to begin</p>
          </div>
        )}
      </div>
    </div>
  );
}
