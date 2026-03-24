/**
 * Task Service
 * Handles API calls for background task management
 */
import axios from '../lib/axios';
import {
  TaskStatusResponse,
  TaskPollingOptions,
  TaskStatus,
} from '../types/task';

export const taskService = {
  /**
   * Get task status by ID
   * Used for polling task completion
   */
  async getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    const response = await axios.get<TaskStatusResponse>(
      `/tasks/${taskId}`
    );
    return response.data;
  },

  /**
   * Poll task until completion or timeout
   * Returns the final task result or throws error
   */
  async pollTask(
    taskId: string,
    options: TaskPollingOptions = {}
  ): Promise<TaskStatusResponse> {
    const {
      interval = 2000, // 2 seconds
      maxAttempts = 60, // 2 minutes total
      onStatusChange,
      onProgress,
    } = options;

    let attempts = 0;
    let lastStatus: TaskStatus | null = null;

    while (attempts < maxAttempts) {
      try {
        const task = await this.getTaskStatus(taskId);

        // Notify status change
        if (task.status !== lastStatus) {
          lastStatus = task.status;
          onStatusChange?.(task.status);
        }

        // Notify progress
        onProgress?.(task);

        // Check terminal states
        if (task.status === TaskStatus.SUCCESS) {
          return task;
        }

        if (task.status === TaskStatus.FAILED) {
          throw new Error(
            task.error_message || 'Task failed with unknown error'
          );
        }

        // Continue polling if PENDING or PROCESSING
        await new Promise((resolve) => setTimeout(resolve, interval));
        attempts++;
      } catch (error) {
        // If it's not an API error, re-throw
        if (error instanceof Error && !error.message.includes('404')) {
          throw error;
        }
        // Task not found yet, continue polling
        await new Promise((resolve) => setTimeout(resolve, interval));
        attempts++;
      }
    }

    throw new Error(
      `Task polling timeout after ${maxAttempts} attempts (${
        (maxAttempts * interval) / 1000
      }s)`
    );
  },

  /**
   * Poll task with typed result
   * Generic version that casts result to expected type
   */
  async pollTaskTyped<T>(
    taskId: string,
    options: TaskPollingOptions = {}
  ): Promise<T> {
    const task = await this.pollTask(taskId, options);
    if (!task.result) {
      throw new Error('Task completed but result is null');
    }
    return task.result as T;
  },
};

export default taskService;
