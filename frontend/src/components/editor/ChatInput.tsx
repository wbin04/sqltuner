import React, { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ 
  onSend, 
  disabled = false,
  placeholder = 'Ask a question about your database or request a query...'
}: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-border dark:border-border-dark bg-surface dark:bg-surface-dark p-4">
      <div className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            rows={3}
            className={cn(
              'w-full px-4 py-3 rounded-lg resize-none',
              'bg-background dark:bg-background-dark border border-border dark:border-border-dark',
              'text-text-main-DEFAULT dark:text-text-main-dark placeholder:text-text-muted-DEFAULT dark:placeholder:text-text-muted-dark',
              'focus:outline-none focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary-dark/50 focus:border-primary dark:focus:border-primary-dark',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all'
            )}
          />
        </div>
        
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className={cn(
            'px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2',
            'bg-primary dark:bg-primary-dark hover:bg-primary-hover dark:hover:bg-primary-dark-hover text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'hover:shadow-lg hover:shadow-primary/20 dark:hover:shadow-primary-dark/20'
          )}
        >
          {disabled ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Send</span>
            </>
          )}
        </button>
      </div>

      <div className="mt-2 text-xs text-text-muted-DEFAULT dark:text-text-muted-dark">
        Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-surface-highlight-dark text-slate-900 dark:text-text-main-dark border border-slate-300 dark:border-transparent">Enter</kbd> to send, 
        <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-surface-highlight-dark text-slate-900 dark:text-text-main-dark border border-slate-300 dark:border-transparent ml-1">Shift + Enter</kbd> for new line
      </div>
    </form>
  );
}
