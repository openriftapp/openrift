interface PageWatch {
  repaint: () => void;
  stop: () => void;
}

/**
 * Repaints after the host page changes the subtree. The records a repaint itself
 * causes are taken unread, so painting never schedules another paint.
 */
export function watchPage(
  target: Node,
  paint: () => void,
  schedule: (run: () => void) => void,
  afterPaint?: () => void,
): PageWatch {
  const observer = new MutationObserver(() => {
    schedule(repaint);
  });
  /**
   * Paint must stay synchronous: the host cannot mutate the page while it runs,
   * so every record still queued afterwards is the painter's own.
   */
  function repaint(): void {
    paint();
    observer.takeRecords();
    afterPaint?.();
  }
  observer.observe(target, { childList: true, subtree: true });
  return {
    repaint,
    stop: () => {
      observer.disconnect();
    },
  };
}
