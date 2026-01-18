/**
 * useWorkspace Hook
 * Custom hook for workspace data management with auto-sync logic
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceService } from '../services/workspaceService';
import { Workspace } from '../types/workspace';

export function useWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();

  // Query: Fetch workspace data
  const {
    data: workspace,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => workspaceService.getById(workspaceId),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation: Sync schema from real database
  const syncMutation = useMutation({
    mutationFn: () => workspaceService.syncSchema(workspaceId),
    onSuccess: (data) => {
      // Manually update the query cache with new schema
      queryClient.setQueryData<Workspace>(['workspace', workspaceId], (old) => {
        if (!old) return old;
        return {
          ...old,
          meta_schema: data.schema || {},
        };
      });
    },
  });

  return {
    workspace,
    isLoading,
    isError,
    error,
    syncSchema: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    syncError: syncMutation.error,
  };
}
