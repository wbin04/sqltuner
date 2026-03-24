/**
 * useTaskPolling Hook
 * React hook for polling background task status
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { taskService } from '../services/taskService';
import {
  TaskStatus,
  TaskStatusResponse,
  TaskPollingOptions,
} from '../types/task';

interface UseTaskPollingReturn {
  task: TaskStatusResponse | null;
  isPolling: boolean;
  error: Error | null;
  startPolling: (taskId: string, options?: TaskPollingOptions) => Promise<void>;
  stopPolling: () => void;
  reset: () => void;
}

/**
 * Hook để poll task status với các features:
 * - Auto polling với interval
 * - Status change callbacks
 * - Error handling
 * - Cleanup on unmount
 */
export function useTaskPolling(): UseTaskPollingReturn {
  const [task, setTask] = useState<TaskStatusResponse | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const pollingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const stopPolling = useCallback(() => {
    pollingRef.current = false;
    abortControllerRef.current?.abort();
    setIsPolling(false);
  }, []);

  const startPolling = useCallback(
    async (taskId: string, options: TaskPollingOptions = {}) => {
      // Reset state
      setError(null);
      setTask(null);
      setIsPolling(true);
      pollingRef.current = true;

      // Create abort controller for cleanup
      abortControllerRef.current = new AbortController();

      const {
        interval = 2000,
        maxAttempts = 60,
        onStatusChange,
        onProgress,
      } = options;

      let attempts = 0;

      try {
        while (pollingRef.current && attempts < maxAttempts) {
          // Check if aborted
          if (abortControllerRef.current?.signal.aborted) {
            break;
          }

          try {
            const taskStatus = await taskService.getTaskStatus(taskId);
            setTask(taskStatus);

            // Callback cho status change
            onStatusChange?.(taskStatus.status);
            onProgress?.(taskStatus);

            // Check terminal states
            if (taskStatus.status === TaskStatus.SUCCESS) {
              setIsPolling(false);
              pollingRef.current = false;
              return;
            }

            if (taskStatus.status === TaskStatus.FAILED) {
              const err = new Error(
                taskStatus.error_message || 'Task failed'
              );
              setError(err);
              setIsPolling(false);
              pollingRef.current = false;
              throw err;
            }

            // Continue polling
            await new Promise((resolve) => setTimeout(resolve, interval));
            attempts++;
          } catch (err) {
            if (err instanceof Error && err.message.includes('404')) {
              // Task not found yet, continue
              await new Promise((resolve) => setTimeout(resolve, interval));
              attempts++;
            } else {
              throw err;
            }
          }
        }

        // Timeout
        if (attempts >= maxAttempts) {
          const timeoutError = new Error(
            `Task polling timeout after ${
              (maxAttempts * interval) / 1000
            } seconds`
          );
          setError(timeoutError);
          throw timeoutError;
        }
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsPolling(false);
        pollingRef.current = false;
      }
    },
    []
  );

  const reset = useCallback(() => {
    stopPolling();
    setTask(null);
    setError(null);
    setIsPolling(false);
  }, [stopPolling]);

  return {
    task,
    isPolling,
    error,
    startPolling,
    stopPolling,
    reset,
  };
}

/**
 * Hook variant với typed result
 * Automatically extracts and types the result field
 */
export function useTaskPollingTyped<T>(): Omit<
  UseTaskPollingReturn,
  'task'
> & {
  result: T | null;
} {
  const { task, ...rest } = useTaskPolling();

  return {
    ...rest,
    result: (task?.result as T) || null,
  };
}
