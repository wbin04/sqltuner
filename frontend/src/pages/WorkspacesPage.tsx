/**
 * WorkspacesPage
 * Main page for managing database workspaces
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Database } from 'lucide-react';
import { cn } from '../lib/utils';
import { workspaceService } from '../services/workspaceService';
import { WorkspaceCard } from '../components/workspaces/WorkspaceCard';
import { CreateWorkspaceModal } from '../components/workspaces/CreateWorkspaceModal';
import { EditWorkspaceModal } from '../components/workspaces/EditWorkspaceModal';
import { CreateWorkspacePayload, Workspace } from '../types/workspace';

export function WorkspacesPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const queryClient = useQueryClient();

  // Fetch workspaces
  const { data: workspaces, isLoading, error } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceService.getAll,
  });

  // Create workspace mutation
  const createMutation = useMutation({
    mutationFn: (payload: CreateWorkspacePayload) => workspaceService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });

  // Update workspace mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Workspace> }) => 
      workspaceService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });

  const handleCreateWorkspace = async (payload: CreateWorkspacePayload) => {
    await createMutation.mutateAsync(payload);
  };

  const handleUpdateWorkspace = async (data: Partial<Workspace>) => {
    if (!editingWorkspace) return;
    await updateMutation.mutateAsync({ id: editingWorkspace.id, data });
    setEditingWorkspace(null);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['workspaces'] });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark">
        <div className="container mx-auto px-6 py-8">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="h-10 w-48 bg-surface-DEFAULT dark:bg-surface-dark rounded animate-pulse mb-2" />
            <div className="h-4 w-96 bg-surface-DEFAULT dark:bg-surface-dark rounded animate-pulse" />
          </div>

          {/* Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-64 bg-surface-DEFAULT dark:bg-surface-dark rounded-xl animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Database className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-2">
            Failed to load workspaces
          </h2>
          <p className="text-text-muted-DEFAULT dark:text-text-muted-dark mb-4">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
          <button
            onClick={handleRefresh}
            className={cn(
              'px-4 py-2 rounded-lg font-medium text-white',
              'bg-primary dark:bg-primary-dark',
              'hover:bg-primary-hover dark:hover:bg-primary-dark-hover'
            )}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  const isEmpty = !workspaces || workspaces.length === 0;

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-main-DEFAULT dark:text-text-main-dark mb-2">
              Workspaces
            </h1>
            <p className="text-text-muted-DEFAULT dark:text-text-muted-dark">
              Manage your database connections and virtual schemas
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white',
              'bg-primary dark:bg-primary-dark',
              'hover:bg-primary-hover dark:hover:bg-primary-dark-hover',
              'transition-colors shadow-lg'
            )}
          >
            <Plus className="w-5 h-5" />
            Create New
          </button>
        </div>

        {/* Content */}
        {isEmpty ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-16">
            <div className={cn(
              'w-24 h-24 rounded-full flex items-center justify-center mb-6',
              'bg-surface-DEFAULT dark:bg-surface-dark',
              'border-2 border-dashed border-border-DEFAULT dark:border-border-dark'
            )}>
              <Database className="w-12 h-12 text-text-muted-DEFAULT dark:text-text-muted-dark" />
            </div>
            <h2 className="text-2xl font-semibold text-text-main-DEFAULT dark:text-text-main-dark mb-2">
              No workspaces found
            </h2>
            <p className="text-text-muted-DEFAULT dark:text-text-muted-dark mb-6 text-center max-w-md">
              Get started by creating your first workspace. Connect to a real database or create a virtual simulation.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white',
                'bg-primary dark:bg-primary-dark',
                'hover:bg-primary-hover dark:hover:bg-primary-dark-hover',
                'transition-colors shadow-lg'
              )}
            >
              <Plus className="w-5 h-5" />
              Create Your First Workspace
            </button>
          </div>
        ) : (
          // Workspace Grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((workspace) => (
              <WorkspaceCard
                key={workspace.id}
                workspace={workspace}
                onDelete={handleRefresh}
                onSync={handleRefresh}
                onEdit={() => setEditingWorkspace(workspace)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateWorkspaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateWorkspace}
      />

      {/* Edit Modal */}
      {editingWorkspace && (
        <EditWorkspaceModal
          isOpen={true}
          onClose={() => setEditingWorkspace(null)}
          onSubmit={handleUpdateWorkspace}
          workspace={editingWorkspace}
        />
      )}
    </div>
  );
}
