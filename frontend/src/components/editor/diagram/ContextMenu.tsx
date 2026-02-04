/**
 * ContextMenu Component
 * Right-click context menu for diagram actions
 */
import { memo } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAddTable: () => void;
}

export const ContextMenu = memo(({ x, y, onClose, onAddTable }: ContextMenuProps) => {
  const handleAddTable = () => {
    onAddTable();
    onClose();
  };

  return (
    <>
      {/* Backdrop to close menu on click */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      
      {/* Menu */}
      <div
        className={cn(
          'fixed z-50 min-w-[180px] rounded-lg shadow-lg border',
          'bg-surface-light dark:bg-surface-dark',
          'border-border-DEFAULT dark:border-border-dark',
          'py-1'
        )}
        style={{
          left: `${x}px`,
          top: `${y}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleAddTable}
          className={cn(
            'w-full flex items-center gap-2 px-4 py-2 text-sm',
            'text-text-main-DEFAULT dark:text-text-main-dark',
            'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark',
            'transition-colors'
          )}
        >
          <Plus className="w-4 h-4" />
          Create New Table
        </button>
      </div>
    </>
  );
});

ContextMenu.displayName = 'ContextMenu';
