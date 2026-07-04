import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Zap, FileText, Copy, Check, AlignLeft, Loader2, Edit2, X, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatSql } from '../../utils/sqlFormatter';
import { chatService } from '../../services/chatService';

interface SQLBlockProps {
  sql: string;
  queryLogId?: string;
  onExplain?: (sql: string) => Promise<any> | void;
  onOptimize?: (sql: string) => void;
  onExecute?: (sql: string) => void;
  isExecuting?: boolean;
  isExplaining?: boolean;
  isOptimizing?: boolean;
}

export function SQLBlock({
  sql,
  queryLogId,
  onExplain,
  onOptimize,
  onExecute,
  isExecuting = false,
  isExplaining = false,
  isOptimizing = false
}: SQLBlockProps) {
  const [copied, setCopied] = useState(false);
  const [displaySql, setDisplaySql] = useState(() => formatSql(sql));
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editSqlValue, setEditSqlValue] = useState(displaySql);
  const [isSaving, setIsSaving] = useState(false);
  // Default expanded = true so SQL is always fully shown
  const [isExpanded, setIsExpanded] = useState(true);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const COLLAPSE_HEIGHT = 300;

  // Auto-format SQL whenever it changes from backend/props
  useEffect(() => {
    const formatted = formatSql(sql);
    setDisplaySql(formatted);
  }, [sql]);

  // Auto-resize textarea and detect overflow
  const updateSize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Reset to measure true scrollHeight
    el.style.height = 'auto';
    const scrollH = el.scrollHeight;
    const overflows = scrollH > COLLAPSE_HEIGHT;
    setIsOverflowing(overflows);
    if (isExpanded || !overflows) {
      el.style.height = scrollH + 'px';
      el.style.overflow = 'hidden';
    } else {
      el.style.height = COLLAPSE_HEIGHT + 'px';
      el.style.overflow = 'hidden';
    }
  }, [isExpanded]);

  useEffect(() => {
    updateSize();
  }, [displaySql, isExpanded, updateSize]);

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

  const openEditModal = () => {
    setEditSqlValue(displaySql);
    setIsEditModalOpen(true);
  };

  const saveEdit = async () => {
    try {
      setIsSaving(true);
      if (queryLogId) {
        await chatService.updateMessage(queryLogId, editSqlValue);
      }
      setDisplaySql(editSqlValue);
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Failed to save edited SQL:', error);
      // fallback just update locally if API fails or inform user
      setDisplaySql(editSqlValue);
      setIsEditModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border dark:border-border-dark bg-background dark:bg-background-dark relative flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2 bg-surface dark:bg-surface-dark border-b border-border dark:border-border-dark rounded-t-[7px]">
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

          {/* Edit Button */}
          <button
            onClick={openEditModal}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted-DEFAULT dark:text-text-muted-dark hover:text-text-main-DEFAULT dark:hover:text-text-main-dark transition-colors border-l border-border dark:border-border-dark pl-3"
            title="Edit SQL"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted-DEFAULT dark:text-text-muted-dark hover:text-text-main-DEFAULT dark:hover:text-text-main-dark transition-colors border-l border-border dark:border-border-dark pl-3"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-green-500" />
                <span className="text-green-500">Copied!</span>
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
      <div className="p-4 bg-background dark:bg-background-dark relative">
        <textarea
          ref={textareaRef}
          value={displaySql}
          onChange={handleChange}
          className={cn(
            'w-full font-mono text-sm resize-none',
            'bg-transparent text-text-main-DEFAULT dark:text-text-main-dark',
            'focus:outline-none focus:ring-0',
            'border-0 p-0',
            'selection:bg-primary/20 selection:text-primary dark:selection:bg-primary-dark/30 dark:selection:text-primary-dark'
          )}
          spellCheck={false}
          style={{ minHeight: '80px', overflow: 'hidden' }}
        />

        {/* Fade overlay when collapsed */}
        {isOverflowing && !isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background dark:from-background-dark to-transparent pointer-events-none" />
        )}
      </div>

      {/* Expand/Collapse Toggle — only shown when SQL overflows */}
      {isOverflowing && (
        <div className="flex justify-center -mt-2 relative z-10 pb-3">
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full bg-surface dark:bg-surface-dark border border-border dark:border-border-dark text-text-muted-DEFAULT dark:text-text-muted-dark hover:text-text-main-DEFAULT dark:hover:text-text-main-dark transition-colors shadow-sm"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Collapse SQL
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                Show full SQL
              </>
            )}
          </button>
        </div>
      )}

      {/* Action Bar */}
      <div className="sticky bottom-0 z-20 flex items-center gap-2 px-4 py-3 bg-surface dark:bg-surface-dark border-t border-border dark:border-border-dark rounded-b-[7px]">
        {onExecute && (
          <button
            onClick={() => onExecute(displaySql)}
            disabled={isExecuting || isExplaining || isOptimizing}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm',
              'bg-primary dark:bg-primary-dark hover:bg-primary-hover dark:hover:bg-primary-dark-hover text-white',
              'hover:shadow-lg hover:shadow-primary/20 dark:hover:shadow-primary-dark/20',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isExecuting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            <span>{isExecuting ? 'Executing...' : 'Execute'}</span>
          </button>
        )}

        {onExplain && (
          <button
            onClick={() => onExplain(displaySql)}
            disabled={isExecuting || isExplaining || isOptimizing}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm',
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
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm',
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

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm">
          <div className={cn(
            'flex flex-col w-full max-w-4xl max-h-[85vh] rounded-xl shadow-2xl bg-surface-light dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark overflow-hidden'
          )}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-DEFAULT dark:border-border-dark bg-surface dark:bg-surface-dark">
              <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary dark:text-primary-dark" />
                Edit Generated SQL
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-lg hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark transition-colors text-text-muted-DEFAULT dark:text-text-muted-dark hover:text-text-main-DEFAULT dark:hover:text-text-main-dark"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Monaco Editor or Textarea */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-[400px] border-b border-border-DEFAULT dark:border-border-dark">
              <textarea
                value={editSqlValue}
                onChange={(e) => setEditSqlValue(e.target.value)}
                className={cn(
                  'w-full flex-1 p-4 font-mono text-sm resize-none',
                  'bg-background dark:bg-background-dark text-text-main-DEFAULT dark:text-text-main-dark',
                  'focus:outline-none focus:ring-0',
                  'border-0'
                )}
                spellCheck={false}
              />
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 bg-surface dark:bg-surface-dark">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border-DEFAULT dark:border-border-dark text-text-main-DEFAULT dark:text-text-main-dark hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-primary dark:bg-primary-dark text-white hover:bg-primary-hover dark:hover:bg-primary-dark-hover transition-colors shadow-lg shadow-primary/20 dark:shadow-primary-dark/20 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

