/**
 * Chat Service
 * Handles API calls for conversational AI
 */
import axios from '../lib/axios';

export interface SchemaGeneratedData {
  system_name: string;
  tables: Array<{
    name: string;
    purpose?: string;
    design_rationale?: string;
    columns: Array<{
      name: string;
      type: string;
      is_pk: boolean;
      is_nullable: boolean;
      default?: string | null;
    }>;
    foreign_keys?: Array<{
      column: string;
      ref_table: string;
      ref_column: string;
      on_delete?: string;
    }>;
    indexes?: Array<{
      name: string;
      column_names: string[];
      unique: boolean;
    }>;
  }>;
  relationships?: Array<{
    from_table: string;
    to_table: string;
    type: string;
    description: string;
  }>;
  design_notes?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql_generated?: string;
  schema_generated?: SchemaGeneratedData | null;
  is_schema_design?: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatCompletionRequest {
  connection_id: string;
  conversation_id?: string;
  message: string;
  chat_mode?: 'chat' | 'check' | 'gen' | 'fix';
  clarification_answers?: Array<{ q: string; answer: string }>;
  error_message?: string;
  original_sql?: string;
}

export interface ChatCompletionResponse {
  conversation_id: string;
  role: string;
  content: string;
  sql_generated?: string;
  schema_generated?: SchemaGeneratedData | null;
  is_schema_design?: boolean;
}

export interface TranslateRequest {
  text: string;
  target_language: 'vi' | 'en';
}

export interface TranslateResponse {
  translated_text: string;
}

function normalizeSchemaGenerated(
  value: unknown
): SchemaGeneratedData | null {
  if (value === null || value === undefined) {
    return null;
  }

  let parsed: unknown = value;

  if (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    if (!trimmed || trimmed.toLowerCase() === 'null') {
      return null;
    }

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const maybeSchema = parsed as Partial<SchemaGeneratedData>;
  if (!Array.isArray(maybeSchema.tables)) {
    return null;
  }

  return maybeSchema as SchemaGeneratedData;
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
    return {
      conversation_id: response.data.conversation_id,
      role: response.data.role,
      content: response.data.content,
      sql_generated: response.data.sql_generated,
      schema_generated: normalizeSchemaGenerated(response.data.schema_generated),
      is_schema_design: response.data.is_schema_design ?? false,
    };
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
    return response.data.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      sql_generated: msg.sql_generated,
      schema_generated: normalizeSchemaGenerated(msg.schema_generated),
      is_schema_design: msg.is_schema_design ?? false,
      created_at: msg.created_at,
    }));
  },

  /**
   * Rename a conversation
   */
  async renameConversation(conversationId: string, title: string): Promise<{ id: string; title: string }> {
    const response = await axios.patch<{ id: string; title: string }>(
      `/chat/conversations/${conversationId}/rename`,
      { title }
    );
    return response.data;
  },

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<{ success: boolean; id: string }> {
    const response = await axios.delete<{ success: boolean; id: string }>(
      `/chat/conversations/${conversationId}`
    );
    return response.data;
  },

  /**
   * Update a message's SQL content
   */
  async updateMessage(messageId: string, sql_generated: string): Promise<{ id: string; sql_generated: string }> {
    const response = await axios.patch<{ id: string; sql_generated: string }>(
      `/chat/messages/${messageId}`,
      { sql_generated }
    );
    return response.data;
  },

  /**
   * Translate markdown text
   */
  async translateMarkdown(request: TranslateRequest): Promise<TranslateResponse> {
    const response = await axios.post<TranslateResponse>(
      '/chat/translate',
      request
    );
    return response.data;
  },
};
