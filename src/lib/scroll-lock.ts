let locks = 0;

export function acquireScrollLock(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  locks += 1;
  document.body.dataset.scrollLock = 'true';
  return () => {
    locks = Math.max(0, locks - 1);
    if (locks === 0) {
      delete document.body.dataset.scrollLock;
    }
  };
}
