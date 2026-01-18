/**
 * useEditorLogic Hook
 * Centralized state management and logic for SQL Editor
 */
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService, ChatMessage, Conversation } from '../services/chatService';
import { sqlService, SQLExecuteResponse, SQLOptimizeResponse } from '../services/sqlService';

interface QueryResult {
  sql: string;
  data: SQLExecuteResponse;
  timestamp: number;
}

interface EditorState {
  messages: ChatMessage[];
  conversations: Conversation[];
  activeConversationId: string | null;
  queryResults: Map<string, QueryResult>;
  isOptimizing: boolean;
  optimizationResult: SQLOptimizeResponse | null;
  isExecuting: boolean;
}

interface UseEditorLogicProps {
  connectionId: string;
}

export function useEditorLogic({ connectionId }: UseEditorLogicProps) {
  const queryClient = useQueryClient();
  
  // State
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [queryResults, setQueryResults] = useState<Map<string, QueryResult>>(new Map());
  const [optimizationResult, setOptimizationResult] = useState<SQLOptimizeResponse | null>(null);
  const [isOptimizationModalOpen, setIsOptimizationModalOpen] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);

  // Fetch conversations
  const { data: conversations = [], isLoading: isLoadingConversations } = useQuery({
    queryKey: ['conversations', connectionId],
    queryFn: () => chatService.getConversations(connectionId),
    enabled: !!connectionId,
  });

  // Fetch messages for active conversation
  const { data: fetchedMessages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ['messages', activeConversationId],
    queryFn: () => chatService.getMessages(activeConversationId!),
    enabled: !!activeConversationId,
  });

  // Combine fetched messages with optimistic messages
  const messages = [...fetchedMessages, ...optimisticMessages];

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (message: string) =>
      chatService.sendMessage({
        connection_id: connectionId,
        conversation_id: activeConversationId || undefined,
        message,
      }),
    onMutate: async (message: string) => {
      // Add optimistic user message
      const userMessage: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      };

      // Add loading assistant message
      const loadingMessage: ChatMessage = {
        id: `temp-loading-${Date.now()}`,
        role: 'assistant',
        content: 'Processing...',
        created_at: new Date().toISOString(),
      };

      setOptimisticMessages([userMessage, loadingMessage]);
    },
    onSuccess: (response) => {
      // Clear optimistic messages
      setOptimisticMessages([]);
      
      // Update active conversation ID if it was a new conversation
      if (!activeConversationId) {
        setActiveConversationId(response.conversation_id);
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['conversations', connectionId] });
      queryClient.invalidateQueries({ queryKey: ['messages', response.conversation_id] });
    },
    onError: () => {
      // Clear optimistic messages on error
      setOptimisticMessages([]);
    },
  });

  // Execute SQL mutation
  const executeSqlMutation = useMutation({
    mutationFn: (sql: string) =>
      sqlService.execute({
        connection_id: connectionId,
        sql,
      }),
    onSuccess: (data, sql) => {
      // Store result in state
      const result: QueryResult = {
        sql,
        data,
        timestamp: Date.now(),
      };
      
      setQueryResults((prev) => {
        const newMap = new Map(prev);
        newMap.set(sql, result);
        return newMap;
      });
    },
  });

  // Optimize SQL mutation
  const optimizeSqlMutation = useMutation({
    mutationFn: (sql: string) =>
      sqlService.optimize({
        connection_id: connectionId,
        sql_query: sql,
        include_explain: true,
      }),
    onSuccess: (data) => {
      setOptimizationResult(data);
      setIsOptimizationModalOpen(true);
    },
  });

  // Explain SQL mutation
  const explainSqlMutation = useMutation({
    mutationFn: (sql: string) =>
      sqlService.explain({
        connection_id: connectionId,
        sql,
      }),
  });

  // Handlers
  const handleSendMessage = useCallback(
    async (message: string) => {
      await sendMessageMutation.mutateAsync(message);
    },
    [sendMessageMutation]
  );

  const handleRunQuery = useCallback(
    async (sql: string) => {
      await executeSqlMutation.mutateAsync(sql);
    },
    [executeSqlMutation]
  );

  const handleOptimize = useCallback(
    async (sql: string) => {
      await optimizeSqlMutation.mutateAsync(sql);
    },
    [optimizeSqlMutation]
  );

  const handleExplain = useCallback(
    async (sql: string) => {
      const result = await explainSqlMutation.mutateAsync(sql);
      return result;
    },
    [explainSqlMutation]
  );

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
  }, []);

  const handleCloseOptimizationModal = useCallback(() => {
    setIsOptimizationModalOpen(false);
    setOptimizationResult(null);
  }, []);

  const handleApplyOptimization = useCallback(() => {
    // This will be handled by the parent component
    // Just close the modal
    setIsOptimizationModalOpen(false);
  }, []);

  return {
    // State
    conversations,
    messages,
    activeConversationId,
    queryResults,
    optimizationResult,
    isOptimizationModalOpen,
    
    // Loading states
    isLoadingConversations,
    isLoadingMessages,
    isSendingMessage: sendMessageMutation.isPending,
    isExecuting: executeSqlMutation.isPending,
    isOptimizing: optimizeSqlMutation.isPending,
    isExplaining: explainSqlMutation.isPending,
    
    // Error states
    sendMessageError: sendMessageMutation.error,
    executeError: executeSqlMutation.error,
    optimizeError: optimizeSqlMutation.error,
    explainError: explainSqlMutation.error,
    
    // Handlers
    handleSendMessage,
    handleRunQuery,
    handleOptimize,
    handleExplain,
    handleNewChat,
    handleSelectConversation,
    handleCloseOptimizationModal,
    handleApplyOptimization,
  };
}
