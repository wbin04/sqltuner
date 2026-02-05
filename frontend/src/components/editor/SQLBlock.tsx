import { useState, useEffect, useRef } from 'react';
import { Play, Zap, FileText, Copy, Check, AlignLeft, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatSql } from '../../utils/sqlFormatter';

interface SQLBlockProps {
  sql: string;
  queryLogId?: string;
  onExplain?: (sql: string) => void;
  onOptimize?: (sql: string) => void;
  onExecute?: (sql: string) => void;
  isExecuting?: boolean;
  isExplaining?: boolean;
  isOptimizing?: boolean;
}

export function SQLBlock({
  sql,
  onExplain,
  onOptimize,
  onExecute,
  isExecuting = false,
  isExplaining = false,
  isOptimizing = false
}: SQLBlockProps) {
  const [copied, setCopied] = useState(false);
  const [displaySql, setDisplaySql] = useState(() => formatSql(sql));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-format SQL whenever it changes
  useEffect(() => {
    const formatted = formatSql(sql);
    setDisplaySql(formatted);
  }, [sql]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [displaySql]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displaySql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormat = () => {
    const formatted = formatSql(displaySql);
    setDisplaySql(formatted);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDisplaySql(e.target.value);
  };

  return (
    <div className="rounded-lg border border-border dark:border-border-dark overflow-hidden bg-background dark:bg-background-dark">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface dark:bg-surface-dark border-b border-border dark:border-border-dark">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary dark:text-primary-dark" />
          <span className="text-sm font-medium text-text-main-DEFAULT dark:text-text-main-dark">Generated SQL</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Format Button */}
          <button
            onClick={handleFormat}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted-DEFAULT dark:text-text-muted-dark hover:text-text-main-DEFAULT dark:hover:text-text-main-dark transition-colors"
            title="Beautify SQL"
          >
            <AlignLeft className="w-3 h-3" />
            <span>Format</span>
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted-DEFAULT dark:text-text-muted-dark hover:text-text-main-DEFAULT dark:hover:text-text-main-dark transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* SQL Code - Editable Textarea */}
      <div className="p-4">
        <textarea
          ref={textareaRef}
          value={displaySql}
          onChange={handleChange}
          className={cn(
            'w-full font-mono text-sm resize-none overflow-hidden',
            'bg-transparent text-text-main-DEFAULT dark:text-text-main-dark',
            'focus:outline-none focus:ring-0',
            'border-0 p-0'
          )}
          spellCheck={false}
          style={{ minHeight: '100px' }}
        />
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-surface dark:bg-surface-dark border-t border-border dark:border-border-dark">
        {onExecute && (
          <button
            onClick={() => onExecute(displaySql)}
            disabled={isExecuting || isExplaining || isOptimizing}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
              'bg-primary dark:bg-primary-dark hover:bg-primary-hover dark:hover:bg-primary-dark-hover text-white',
              'hover:shadow-lg hover:shadow-primary/20 dark:hover:shadow-primary-dark/20',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isExecuting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>{isExecuting ? 'Executing...' : 'Run Query'}</span>
          </button>
        )}

        {onExplain && (
          <button
            onClick={() => onExplain(displaySql)}
            disabled={isExecuting || isExplaining || isOptimizing}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
              'bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark hover:bg-border dark:hover:bg-border-dark text-text-main-DEFAULT dark:text-text-main-dark border border-border dark:border-border-dark',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isExplaining ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            <span>{isExplaining ? 'Explaining...' : 'Explain'}</span>
          </button>
        )}

        {onOptimize && (
          <button
            onClick={() => onOptimize(displaySql)}
            disabled={isExecuting || isExplaining || isOptimizing}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
              'bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark hover:bg-border dark:hover:bg-border-dark text-text-main-DEFAULT dark:text-text-main-dark border border-border dark:border-border-dark',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isOptimizing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            <span>{isOptimizing ? 'Optimizing...' : 'Optimize'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
