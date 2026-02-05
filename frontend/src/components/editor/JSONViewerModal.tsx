/**
 * JSONViewerModal Component
 * Displays JSON data in a formatted, readable modal
 */
import { X, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';

interface JSONViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  jsonData: any;
  columnName?: string;
}

export function JSONViewerModal({ isOpen, onClose, jsonData, columnName }: JSONViewerModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const formattedJSON = JSON.stringify(jsonData, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJSON);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" />

      {/* Modal Content */}
      <div
        className={cn(
          'relative w-full max-w-3xl max-h-[80vh] rounded-xl shadow-2xl flex flex-col',
          'bg-surface-light dark:bg-surface-dark',
          'border border-border-DEFAULT dark:border-border-dark'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-DEFAULT dark:border-border-dark flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark">
              JSON Viewer
            </h3>
            {columnName && (
              <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">
                Column: {columnName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
                'bg-primary dark:bg-primary-dark text-white',
                'hover:opacity-90 transition-opacity'
              )}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className={cn(
                'p-2 rounded-lg transition-colors',
                'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark'
              )}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* JSON Content */}
        <div className="flex-1 overflow-auto p-6">
          <pre className={cn(
            'text-sm font-mono',
            'text-text-main-DEFAULT dark:text-text-main-dark',
            'whitespace-pre-wrap break-words'
          )}>
            {formattedJSON}
          </pre>
        </div>
      </div>
    </div>
  );
}
