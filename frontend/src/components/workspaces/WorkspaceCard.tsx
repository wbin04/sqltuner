/**
 * WorkspaceCard Component
 * Displays a single workspace item with actions
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Box, RefreshCw, Trash2, Calendar, Edit2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Workspace, DbType } from '../../types/workspace';
import { workspaceService } from '../../services/workspaceService';
import { format } from 'date-fns';

interface WorkspaceCardProps {
  workspace: Workspace;
  onDelete: () => void;
  onSync: () => void;
  onEdit: () => void;
}

export function WorkspaceCard({ workspace, onDelete, onSync, onEdit }: WorkspaceCardProps) {
  const navigate = useNavigate();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSync = async () => {
    if (workspace.db_type === DbType.SIMULATION) return;
    
    setIsSyncing(true);
    try {
      await workspaceService.syncSchema(workspace.id);
      onSync();
    } catch (error) {
      console.error('Failed to sync schema:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${workspace.name}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await workspaceService.delete(workspace.id);
      onDelete();
    } catch (error) {
      console.error('Failed to delete workspace:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConnect = () => {
    navigate(`/editor/${workspace.id}`);
  };

  const getBadgeColor = () => {
    switch (workspace.db_type) {
      case DbType.SIMULATION:
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case DbType.POSTGRES:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case DbType.MYSQL:
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getIcon = () => {
    return workspace.db_type === DbType.SIMULATION ? Box : Database;
  };

  const Icon = getIcon();

  return (
    <div
      className={cn(
        'group relative rounded-xl p-6 transition-all duration-200',
        'bg-surface-light dark:bg-surface-dark',
        'border border-border-DEFAULT dark:border-border-dark',
        'hover:border-primary/50 dark:hover:border-primary-dark/50',
        'hover:shadow-lg',
        isDeleting && 'opacity-50 pointer-events-none'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <div className={cn(
            'w-12 h-12 rounded-lg flex items-center justify-center',
            workspace.db_type === DbType.SIMULATION
              ? 'bg-purple-100 dark:bg-purple-900/30'
              : 'bg-blue-100 dark:bg-blue-900/30'
          )}>
            <Icon className={cn(
              'w-6 h-6',
              workspace.db_type === DbType.SIMULATION
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-blue-600 dark:text-blue-400'
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-text-main-DEFAULT dark:text-text-main-dark truncate">
              {workspace.name}
            </h3>
            <span className={cn(
              'inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium',
              getBadgeColor()
            )}>
              {workspace.db_type === DbType.SIMULATION ? 'Simulation' : workspace.db_type.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-2 mb-4">
        {workspace.db_type !== DbType.SIMULATION ? (
          <>
            <div className="flex items-center gap-2 text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
              <Database className="w-4 h-4" />
              <span className="truncate">
                {workspace.host}:{workspace.port} / {workspace.db_name}
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
            Virtual Schema
          </p>
        )}
        <div className="flex items-center gap-2 text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
          <Calendar className="w-3.5 h-3.5" />
          <span>Created {format(new Date(workspace.created_at), 'MMM d, yyyy')}</span>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-border-DEFAULT dark:border-border-dark">
        <button
          onClick={handleConnect}
          className={cn(
            'flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
            'bg-primary dark:bg-primary-dark text-white',
            'hover:bg-primary-hover dark:hover:bg-primary-dark-hover'
          )}
        >
          Connect
        </button>

        <button
          onClick={onEdit}
          className={cn(
            'px-3 py-2 rounded-lg transition-colors',
            'bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark',
            'hover:bg-primary/10 dark:hover:bg-primary-dark/10',
            'text-text-main-DEFAULT dark:text-text-main-dark'
          )}
          title="Edit"
        >
          <Edit2 className="w-4 h-4" />
        </button>

        {workspace.db_type !== DbType.SIMULATION && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={cn(
              'px-3 py-2 rounded-lg transition-colors',
              'bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark',
              'hover:bg-primary/10 dark:hover:bg-primary-dark/10',
              'text-text-main-DEFAULT dark:text-text-main-dark',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="Sync Schema"
          >
            <RefreshCw className={cn('w-4 h-4', isSyncing && 'animate-spin')} />
          </button>
        )}

        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className={cn(
            'px-3 py-2 rounded-lg transition-colors',
            'hover:bg-red-50 dark:hover:bg-red-900/20',
            'text-text-muted-DEFAULT dark:text-text-muted-dark',
            'hover:text-red-600 dark:hover:text-red-400',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
