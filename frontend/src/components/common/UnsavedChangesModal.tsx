import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onSave: () => void | Promise<void>;
  onDiscard: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function UnsavedChangesModal({
  isOpen,
  onSave,
  onDiscard,
  onCancel,
  isSaving = false,
}: UnsavedChangesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => {
          console.log('[UnsavedChangesModal] Backdrop clicked - calling onCancel');
          onCancel();
        }}
      />

      {/* Modal */}
      <div 
        className={cn(
          'relative w-full max-w-md mx-4 rounded-lg shadow-2xl',
          'bg-surface-light dark:bg-surface-dark',
          'border border-border-DEFAULT dark:border-border-dark'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-6 pb-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-500/10 dark:bg-yellow-500/20 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-text-main-DEFAULT dark:text-text-main-dark">
              Unsaved Changes
            </h3>
            <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">
              You have unsaved changes. Do you want to save them before leaving?
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 p-6 pt-2">
          <button
            onClick={onDiscard}
            disabled={isSaving}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors',
              'text-red-600 dark:text-red-400',
              'hover:bg-red-500/10 dark:hover:bg-red-500/20',
              'border border-red-200 dark:border-red-800',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Discard Changes
          </button>
          
          <button
            onClick={onCancel}
            disabled={isSaving}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors',
              'text-text-main-DEFAULT dark:text-text-main-dark',
              'hover:bg-surface-highlight-light dark:hover:bg-surface-highlight-dark',
              'border border-border-DEFAULT dark:border-border-dark',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Cancel
          </button>

          <button
            onClick={onSave}
            disabled={isSaving}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors',
              'bg-primary dark:bg-primary-dark text-white',
              'hover:bg-primary/90 dark:hover:bg-primary-dark/90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-2'
            )}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
