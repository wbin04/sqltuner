/**
 * Chat Service
 * Handles API calls for conversational AI
 */
import axios from '../lib/axios';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql_generated?: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

export interface ChatCompletionRequest {
  connection_id: string;
  conversation_id?: string;
  message: string;
}

export interface ChatCompletionResponse {
  conversation_id: string;
  role: string;
  content: string;
  sql_generated?: string;
}

export const chatService = {
  /**
   * Send a chat message and get AI response
   */
  async sendMessage(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const response = await axios.post<ChatCompletionResponse>(
      '/chat/completion',
      request
    );
    return response.data;
  },

  /**
   * Get all conversations for a connection
   */
  async getConversations(connectionId: string): Promise<Conversation[]> {
    const response = await axios.get<Conversation[]>(
      `/chat/conversations/${connectionId}`
    );
    return response.data;
  },

  /**
   * Get all messages in a conversation
   */
  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const response = await axios.get<ChatMessage[]>(
      `/chat/conversations/${conversationId}/messages`
    );
    return response.data;
  },
};
