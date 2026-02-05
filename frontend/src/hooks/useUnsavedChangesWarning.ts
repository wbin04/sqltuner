import { useEffect, useCallback, useRef, useState } from 'react';

interface UseUnsavedChangesWarningOptions {
  when: boolean;
  onNavigate?: () => void;
}

/**
 * Custom hook to warn users about unsaved changes
 * Compatible with BrowserRouter (non-data router)
 */
export function useUnsavedChangesWarning({ when, onNavigate }: UseUnsavedChangesWarningOptions) {
  const [isNavigationAllowed, setIsNavigationAllowed] = useState(false);
  const pendingNavigation = useRef<(() => void) | null>(null);

  // Prevent page refresh/close with custom modal
  useEffect(() => {
    if (!when) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (when && !isNavigationAllowed) {
        console.log('[useUnsavedChangesWarning] beforeunload triggered, showing modal');
        // Prevent the unload
        e.preventDefault();
        e.returnValue = '';
        
        // Show the modal for refresh/close
        if (onNavigate) {
          onNavigate();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [when, onNavigate, isNavigationAllowed]);

  // Prevent navigation by clicking links
  useEffect(() => {
    if (!when) return;

    const handleClick = (e: MouseEvent) => {
      if (!isNavigationAllowed && when) {
        const target = e.target as HTMLElement;
        const anchor = target.closest('a');
        
        if (anchor && anchor.href && !anchor.target) {
          const url = new URL(anchor.href);
          const currentUrl = new URL(window.location.href);
          
          // Only block if navigating to different page
          if (url.pathname !== currentUrl.pathname) {
            e.preventDefault();
            
            // Store pending navigation
            pendingNavigation.current = () => {
              window.location.href = anchor.href;
            };
            
            if (onNavigate) {
              onNavigate();
            }
          }
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [when, onNavigate, isNavigationAllowed]);

  // Helper to allow navigation
  const allowNavigation = useCallback(() => {
    setIsNavigationAllowed(true);
    
    // Execute pending navigation after a small delay
    setTimeout(() => {
      if (pendingNavigation.current) {
        pendingNavigation.current();
        pendingNavigation.current = null;
      }
      setIsNavigationAllowed(false);
    }, 100);
  }, []);

  return { allowNavigation };
}
