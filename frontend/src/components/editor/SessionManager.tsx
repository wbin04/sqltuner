/**
 * SessionManager Component (Pane A - Left Sidebar)
 * Manages conversation sessions for the current workspace
 * Features: create, rename, delete, sorted by newest first
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, MessageSquare, Calendar, MoreVertical, Pencil, Trash2, Check, X } from 'lucide-react';
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
  onRenameConversation?: (id: string, newTitle: string) => Promise<void>;
  onDeleteConversation?: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export function SessionManager({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  isLoading = false,
}: SessionManagerProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Sort conversations by created_at descending (newest first)
  const sortedConversations = [...conversations].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus rename input
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleOpenMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setOpenMenuId(prev => (prev === id ? null : id));
  }, []);

  const handleStartRename = useCallback((conversation: Conversation) => {
    setOpenMenuId(null);
    setRenamingId(conversation.id);
    setRenameValue(conversation.title);
  }, []);

  const handleConfirmRename = useCallback(async () => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await onRenameConversation?.(renamingId, renameValue.trim());
    } finally {
      setRenamingId(null);
      setRenameValue('');
    }
  }, [renamingId, renameValue, onRenameConversation]);

  const handleCancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
  }, []);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleConfirmRename();
      if (e.key === 'Escape') handleCancelRename();
    },
    [handleConfirmRename, handleCancelRename]
  );

  const handleDelete = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setOpenMenuId(null);
    setDeletingId(id);
    try {
      await onDeleteConversation?.(id);
    } finally {
      setDeletingId(null);
    }
  }, [onDeleteConversation]);

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
        ) : sortedConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <MessageSquare className="w-12 h-12 text-text-muted-DEFAULT dark:text-text-muted-dark mb-3 opacity-50" />
            <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
              No conversations yet. Start a new chat!
            </p>
          </div>
        ) : (
          <div className="space-y-1" ref={menuRef}>
            {sortedConversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              const isMenuOpen = openMenuId === conversation.id;
              const isRenaming = renamingId === conversation.id;
              const isDeleting = deletingId === conversation.id;

              return (
                <div
                  key={conversation.id}
                  className={cn(
                    'group relative flex items-start gap-2 px-3 py-3 rounded-lg transition-all',
                    'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark',
                    isActive && 'bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark border border-primary/30 dark:border-primary-dark/30',
                    isDeleting && 'opacity-50 pointer-events-none'
                  )}
                >
                  {/* Clickable session area */}
                  <button
                    onClick={() => !isRenaming && onSelectConversation(conversation.id)}
                    className="flex items-start gap-2 flex-1 min-w-0 text-left"
                    disabled={isRenaming || isDeleting}
                  >
                    <MessageSquare className={cn(
                      'w-4 h-4 flex-shrink-0 mt-0.5',
                      isActive ? 'text-primary dark:text-primary-dark' : 'text-text-muted-DEFAULT dark:text-text-muted-dark'
                    )} />
                    <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        /* Inline rename input */
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={handleRenameKeyDown}
                            className={cn(
                              'flex-1 min-w-0 text-sm font-medium rounded px-1 py-0.5',
                              'bg-background-light dark:bg-background-dark',
                              'border border-primary/50 dark:border-primary-dark/50',
                              'text-text-main-DEFAULT dark:text-text-main-dark',
                              'outline-none focus:border-primary dark:focus:border-primary-dark'
                            )}
                          />
                          <button
                            onClick={e => { e.stopPropagation(); handleConfirmRename(); }}
                            className="flex-shrink-0 p-0.5 rounded text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                            title="Confirm"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleCancelRename(); }}
                            className="flex-shrink-0 p-0.5 rounded text-text-muted-DEFAULT dark:text-text-muted-dark hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark transition-colors"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <p className={cn(
                          'text-sm font-medium truncate',
                          isActive ? 'text-text-main-DEFAULT dark:text-text-main-dark' : 'text-text-main-DEFAULT dark:text-text-main-dark'
                        )}>
                          {conversation.title}
                        </p>
                      )}
                      {!isRenaming && (
                        <div className="flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3 text-text-muted-DEFAULT dark:text-text-muted-dark" />
                          <span className="text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
                            {format(new Date(conversation.created_at), 'MMM d, h:mm a')}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* 3-dot menu button — visible on hover or when menu is open */}
                  {!isRenaming && (
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={e => handleOpenMenu(e, conversation.id)}
                        className={cn(
                          'p-1 rounded transition-all',
                          'text-text-muted-DEFAULT dark:text-text-muted-dark',
                          'hover:bg-surface-highlight-DEFAULT dark:hover:bg-surface-highlight-dark',
                          'hover:text-text-main-DEFAULT dark:hover:text-text-main-dark',
                          isMenuOpen
                            ? 'opacity-100 bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark text-text-main-DEFAULT dark:text-text-main-dark'
                            : 'opacity-0 group-hover:opacity-100'
                        )}
                        title="More options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown menu */}
                      {isMenuOpen && (
                        <div className={cn(
                          'absolute right-0 z-50 mt-1 w-36',
                          'rounded-lg shadow-lg overflow-hidden',
                          'bg-surface-light dark:bg-surface-dark',
                          'border border-border-DEFAULT dark:border-border-dark'
                        )}>
                          <button
                            onClick={e => { e.stopPropagation(); handleStartRename(conversation); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-3 py-2 text-sm',
                              'text-text-main-DEFAULT dark:text-text-main-dark',
                              'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark',
                              'transition-colors'
                            )}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Rename
                          </button>
                          <button
                            onClick={e => handleDelete(e, conversation.id)}
                            className={cn(
                              'w-full flex items-center gap-2 px-3 py-2 text-sm',
                              'text-red-600 dark:text-red-400',
                              'hover:bg-red-50 dark:hover:bg-red-900/20',
                              'transition-colors'
                            )}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
