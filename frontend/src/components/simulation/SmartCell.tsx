import { useState, useEffect, useRef } from 'react';
import { Copy, Check, X, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SmartCellProps {
  value: any;
  type: string;
  onSave: (newValue: any) => void;
  onJsonClick?: () => void;
  isReadOnly?: boolean;
}

export function SmartCell({ value, type, onSave, onJsonClick, isReadOnly = false }: SmartCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const [showCopied, setShowCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset temp value when props change
  useEffect(() => {
    setTempValue(value);
  }, [value]);

  // Auto-focus on edit mode
  useEffect(() => {
    if (isEditing) {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      } else if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      }
    }
  }, [isEditing]);

  // Handle copy to clipboard
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = value === null || value === undefined ? '' : 
                       typeof value === 'object' ? JSON.stringify(value, null, 2) : 
                       String(value);
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Handle save
  const handleSave = () => {
    onSave(tempValue);
    setIsEditing(false);
  };

  // Handle cancel
  const handleCancel = () => {
    setTempValue(value);
    setIsEditing(false);
  };

  // Handle click outside for long text popover
  useEffect(() => {
    if (!isEditing || !isLongContent) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleCancel();
      }
    };

    // Delay adding listener to avoid immediate trigger
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing]);

  // Check if content is null/undefined
  const isNull = value === null || value === undefined;
  
  // Check if it's JSON type
  const isJsonType = type.toUpperCase().includes('JSON');
  
  // Check if value is an object (for JSON display)
  const isObject = !isNull && typeof value === 'object';
  
  // Convert to display string
  const displayValue = isNull ? '' : 
                       isObject ? JSON.stringify(value) : 
                       String(value);
  
  // Check if content is long
  const isLongContent = displayValue.length > 50;

  // Special handling for JSON types
  if (isJsonType || isObject) {
    return (
      <div className="group relative w-full flex items-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onJsonClick) {
              onJsonClick();
            }
          }}
          className={cn(
            'px-3 py-1.5 rounded border font-mono text-sm truncate max-w-full',
            'bg-background-light dark:bg-background-dark',
            'border-border-DEFAULT dark:border-border-dark',
            'text-blue-600 dark:text-blue-400',
            'hover:bg-blue-50 dark:hover:bg-blue-900/20',
            'transition-colors cursor-pointer',
            'text-left'
          )}
          title="Click to view JSON"
        >
          <span className="inline-flex items-center gap-2">
            <span>{'{ }'}</span>
            <span className="truncate">{displayValue}</span>
          </span>
        </button>

        {/* Copy button on hover */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-1 py-0.5 shadow-sm rounded">
          <button
            onClick={handleCopy}
            className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
            title="Copy"
          >
            {showCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
    );
  }

  // EDIT MODE - Long Content (Popover with textarea)
  if (isEditing && isLongContent) {
    return (
      <div ref={containerRef} className="relative">
        {/* Invisible placeholder to maintain row height */}
        <div className="invisible px-3 py-1.5 text-sm">
          {displayValue}
        </div>

        {/* Popover floating above */}
        <div className="absolute top-[-10px] left-[-10px] z-[100] w-[400px] bg-white dark:bg-gray-800 border-2 border-primary dark:border-primary-dark rounded-lg shadow-2xl flex flex-col">
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-text-muted-DEFAULT dark:text-text-muted-dark">
                Edit Value
              </span>
              <button
                onClick={handleCancel}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
            <textarea
              ref={textareaRef}
              className={cn(
                'w-full h-32 text-sm p-2 rounded border resize-none',
                'bg-background-light dark:bg-background-dark',
                'border-border-DEFAULT dark:border-border-dark',
                'text-text-main-DEFAULT dark:text-text-main-dark',
                'focus:outline-none focus:ring-2 focus:ring-primary/50'
              )}
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleCancel();
                }
                // Shift+Enter for new line, allow natural behavior
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className={cn(
                  'px-3 py-1.5 text-xs rounded flex items-center gap-1',
                  'text-text-muted-DEFAULT dark:text-text-muted-dark',
                  'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark',
                  'transition-colors'
                )}
              >
                <X size={12} />
                Cancel
              </button>
              <button
                onClick={handleSave}
                className={cn(
                  'px-3 py-1.5 text-xs rounded flex items-center gap-1',
                  'bg-primary dark:bg-primary-dark text-white',
                  'hover:bg-primary/90 dark:hover:bg-primary-dark/90',
                  'transition-colors'
                )}
              >
                <Check size={12} />
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Backdrop overlay */}
        <div className="fixed inset-0 z-[90] bg-black/20" />
      </div>
    );
  }

  // EDIT MODE - Short Content (Inline input)
  if (isEditing && !isLongContent) {
    return (
      <input
        ref={inputRef}
        type="text"
        className={cn(
          'w-full px-3 py-1.5 rounded border-2 text-sm',
          'bg-background-light dark:bg-background-dark',
          'border-primary dark:border-primary-dark',
          'text-text-main-DEFAULT dark:text-text-main-dark',
          'focus:outline-none focus:ring-2 focus:ring-primary/50'
        )}
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSave();
          }
          if (e.key === 'Escape') {
            handleCancel();
          }
        }}
      />
    );
  }

  // VIEW MODE - Default display
  return (
    <div
      ref={containerRef}
      className="group relative w-full flex items-center"
    >
      {/* Main content - truncated */}
      <div
        className={cn(
          'truncate text-sm w-full px-3 py-1.5 rounded transition-colors',
          !isReadOnly && 'cursor-text hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark',
          isNull && 'text-text-muted-DEFAULT dark:text-text-muted-dark italic'
        )}
        onClick={() => {
          if (!isReadOnly) {
            setIsEditing(true);
          }
        }}
        title={displayValue || 'null'}
      >
        {isNull ? 'null' : displayValue}
      </div>

      {/* Action buttons (show on hover) */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-1 py-0.5 shadow-sm rounded">
        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
          title="Copy to clipboard"
        >
          {showCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>

        {/* Expand button for long content */}
        {isLongContent && !isReadOnly && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
            title="Expand to edit"
          >
            <Maximize2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
