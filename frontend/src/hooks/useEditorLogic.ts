/**
 * useEditorLogic Hook
 * Centralized state management and logic for SQL Editor
 */
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService, ChatMessage } from '../services/chatService';
import { sqlService, SQLExecuteResponse, SQLOptimizeResponse, SQLExplainPlanResponse } from '../services/sqlService';

interface QueryResult {
  sql: string;
  data: SQLExecuteResponse;
  timestamp: number;
}

interface UseEditorLogicProps {
  connectionId: string;
  initialConversationId?: string;
}

export function useEditorLogic({ connectionId, initialConversationId }: UseEditorLogicProps) {
  const queryClient = useQueryClient();

  // State
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId || null);
  const [queryResults, setQueryResults] = useState<Map<string, QueryResult>>(new Map());
  const [optimizationResult, setOptimizationResult] = useState<SQLOptimizeResponse | null>(null);
  const [isOptimizationModalOpen, setIsOptimizationModalOpen] = useState(false);
  const [explainResult, setExplainResult] = useState<SQLExplainPlanResponse | null>(null);
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [appliedOptimizationMessages, setAppliedOptimizationMessages] = useState<ChatMessage[]>([]);
  const [pendingClarification, setPendingClarification] = useState<{
    questions: Array<{ q: string; options?: string[] }>;
    originalMessage: string;
  } | null>(null);

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

  // Combine fetched messages with optimistic messages and applied optimization messages
  const messages = [...fetchedMessages, ...appliedOptimizationMessages, ...optimisticMessages];

  const parseClarificationQuestions = (content: string): Array<{ q: string; options?: string[] }> => {
    const lines = content.split('\n');
    const questions: Array<{ q: string; options?: string[] }> = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      const qMatch = line.match(/^\d+\.\s+(.+)$/);
      if (!qMatch) {
        continue;
      }

      const item: { q: string; options?: string[] } = { q: qMatch[1] };
      const nextLine = (lines[index + 1] || '').trim();
      if (nextLine.startsWith('Options:')) {
        item.options = nextLine
          .replace(/^Options:\s*/, '')
          .split(',')
          .map((option) => option.trim())
          .filter(Boolean);
      }

      questions.push(item);
    }

    return questions;
  };

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (payload: {
      message: string;
      chat_mode?: 'chat' | 'check' | 'gen' | 'fix';
      clarification_answers?: Array<{ q: string; answer: string }>;
      error_message?: string;
      original_sql?: string;
    }) =>
      chatService.sendMessage({
        connection_id: connectionId,
        conversation_id: activeConversationId || undefined,
        message: payload.message,
        chat_mode: payload.chat_mode,
        clarification_answers: payload.clarification_answers,
        error_message: payload.error_message,
        original_sql: payload.original_sql,
      }),
    onMutate: async (payload: {
      message: string;
      chat_mode?: 'chat' | 'check' | 'gen' | 'fix';
      clarification_answers?: Array<{ q: string; answer: string }>;
      error_message?: string;
      original_sql?: string;
    }) => {
      // Capture send time before mutation
      const sentAt = new Date().toISOString();

      // Add optimistic user message
      const userMessage: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        role: 'user',
        content: payload.message,
        created_at: sentAt,
      };

      // Add loading assistant message
      const loadingMessage: ChatMessage = {
        id: `temp-loading-${Date.now()}`,
        role: 'assistant',
        content: 'Processing...',
        created_at: sentAt,
      };

      setOptimisticMessages([userMessage, loadingMessage]);

      // Return sentAt so onSuccess can use it to fix user message timestamp
      return { sentAt, userContent: payload.message };
    },
    onSuccess: async (response, _payload, context) => {
      // Clear optimistic messages
      setOptimisticMessages([]);

      // Update active conversation ID if it was a new conversation
      if (!activeConversationId) {
        setActiveConversationId(response.conversation_id);
      }

      // Invalidate conversations list (non-blocking)
      queryClient.invalidateQueries({ queryKey: ['conversations', connectionId] });

      // refetchQueries actually awaits until the refetch is complete
      // (unlike invalidateQueries which only marks stale and resolves immediately)
      await queryClient.refetchQueries({ queryKey: ['messages', response.conversation_id] });

      // Now the cache has fresh data — patch user message timestamp back to sent time
      if (context?.sentAt) {
        const cached = queryClient.getQueryData<ChatMessage[]>(['messages', response.conversation_id]);
        if (cached) {
          const fixed = cached.map((msg) => {
            if (
              msg.role === 'user' &&
              msg.content === _payload.message
            ) {
              return { ...msg, created_at: context.sentAt };
            }
            return msg;
          });
          queryClient.setQueryData(['messages', response.conversation_id], fixed);
        }
      }

      if (response.content.includes('Before designing the schema, I have a few questions:')) {
        const questions = parseClarificationQuestions(response.content);
        if (questions.length > 0) {
          setPendingClarification({
            questions,
            originalMessage: response.content,
          });
        }
      }
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
        // Don't send conversation_id - optimization should be fast and standalone
        // Results are shown in modal, not saved to conversation history
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
    onSuccess: (data) => {
      setExplainResult(data);
      setIsExplainModalOpen(true);
    },
  });

  // Handlers
  const handleSendMessage = useCallback(
    async (
      message: string,
      chat_mode?: 'chat' | 'check' | 'gen' | 'fix',
      error_message?: string,
      original_sql?: string
    ) => {
      const lastAssistantMsg = [...fetchedMessages]
        .reverse()
        .find((msg) => msg.role === 'assistant');

      const isClarificationReply =
        Boolean(lastAssistantMsg)
        && (lastAssistantMsg?.content || '').includes('Before designing the schema, I have a few questions:')
        && Boolean(pendingClarification);

      if (isClarificationReply && pendingClarification) {
        await sendMessageMutation.mutateAsync({
          message,
          chat_mode: chat_mode || 'chat',
          clarification_answers: pendingClarification.questions.map((question) => ({
            q: question.q,
            answer: message,
          })),
        });
        setPendingClarification(null);
        return;
      }

      await sendMessageMutation.mutateAsync({ message, chat_mode: chat_mode || 'chat', error_message, original_sql });
    },
    [fetchedMessages, pendingClarification, sendMessageMutation]
  );

  const handleSubmitClarification = useCallback(
    async (answers: Array<{ q: string; answer: string }>) => {
      if (!pendingClarification) return;

      const answerSummary = answers
        .filter(a => a.answer && a.answer !== 'No preference')
        .map(a => `${a.q}: ${a.answer}`)
        .join('; ');

      await sendMessageMutation.mutateAsync({
        message: answerSummary || 'Generate schema with default settings',
        clarification_answers: answers,
      });

      setPendingClarification(null);
    },
    [pendingClarification, sendMessageMutation]
  );

  const handleExecute = useCallback(
    async (sql: string) => {
      await executeSqlMutation.mutateAsync(sql);
    },
    [executeSqlMutation]
  );

  const handleOptimize = useCallback(
    async (sql: string) => {
      // Backend will create conversation if needed
      // No need to pre-create conversation here - saves 1 network round-trip

      await optimizeSqlMutation.mutateAsync(sql);
    },
    [optimizeSqlMutation]
  );

  const handleExplain = useCallback(
    async (sql: string) => {
      await explainSqlMutation.mutateAsync(sql);
    },
    [explainSqlMutation]
  );

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
    // Clear applied optimization messages when starting new chat
    setAppliedOptimizationMessages([]);
    // URL will be updated by the effect in EditorPage
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    // Clear applied optimization messages when switching conversations
    setAppliedOptimizationMessages([]);
    // URL will be updated by the effect in EditorPage
  }, []);

  const handleRenameConversation = useCallback(
    async (conversationId: string, newTitle: string) => {
      await chatService.renameConversation(conversationId, newTitle);
      queryClient.invalidateQueries({ queryKey: ['conversations', connectionId] });
    },
    [connectionId, queryClient]
  );

  const handleDeleteConversation = useCallback(
    async (conversationId: string) => {
      await chatService.deleteConversation(conversationId);
      queryClient.invalidateQueries({ queryKey: ['conversations', connectionId] });
      // If the deleted conversation was active, reset to new chat
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setAppliedOptimizationMessages([]);
      }
    },
    [connectionId, queryClient, activeConversationId]
  );

  const handleCloseOptimizationModal = useCallback(() => {
    setIsOptimizationModalOpen(false);
    setOptimizationResult(null);
  }, []);

  const handleCloseExplainModal = useCallback(() => {
    setIsExplainModalOpen(false);
    setExplainResult(null);
  }, []);

  const handleApplyOptimization = useCallback(
    (combinedScript: string) => {
      // Display the combined script as an assistant message in chat
      const assistantMessage: ChatMessage = {
        id: `optimization-${Date.now()}`,
        role: 'assistant',
        content: 'Applied optimization with the following script:',
        sql_generated: combinedScript,
        created_at: new Date().toISOString(),
      };

      // Add to applied optimization messages (persists across conversation)
      setAppliedOptimizationMessages((prev) => [...prev, assistantMessage]);

      // Close modal
      setIsOptimizationModalOpen(false);
    },
    []
  );

  return {
    // State
    conversations,
    messages,
    activeConversationId,
    queryResults,
    optimizationResult,
    isOptimizationModalOpen,
    explainResult,
    isExplainModalOpen,

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
    handleSubmitClarification,
    handleExecute,
    handleOptimize,
    handleExplain,
    handleNewChat,
    handleSelectConversation,
    handleRenameConversation,
    handleDeleteConversation,
    handleCloseOptimizationModal,
    handleApplyOptimization,
    handleCloseExplainModal,

    // Clarification
    pendingClarification,
  };
}
