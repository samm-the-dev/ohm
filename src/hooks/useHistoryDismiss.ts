import { useEffect, useId, useRef } from 'react';

/**
 * Pushes a history entry when a dialog opens so the browser back button
 * (including Android's gesture/hardware back) dismisses it instead of
 * navigating away. Cleans up the entry when the dialog closes via UI.
 */
export function useHistoryDismiss(open: boolean, onClose: () => void) {
  const id = useId();
  const closedByPop = useRef(false);
  const pushed = useRef(false);

  useEffect(() => {
    if (!open) {
      // Dialog closed via UI (not popstate) — clean up our history entry
      if (pushed.current && !closedByPop.current && history.state?.ohm_dialog === id) {
        history.back();
      }
      pushed.current = false;
      closedByPop.current = false;
      return;
    }

    closedByPop.current = false;
    // StrictMode: only push once per open cycle, but always attach the listener
    if (!pushed.current) {
      pushed.current = true;
      history.pushState({ ohm_dialog: id }, '');
    }

    const handlePop = () => {
      closedByPop.current = true;
      pushed.current = false;
      onClose();
    };

    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
    };
  }, [open, onClose, id]);
}
