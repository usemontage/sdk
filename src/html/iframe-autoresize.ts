/**
 * Content-driven height syncing for a same-origin iframe artifact.
 *
 * Why this exists as its own module: naively writing `iframe.style.height`
 * straight from a ResizeObserver/MutationObserver callback creates two failure
 * modes that freeze the *parent* page (the iframe shares the main thread):
 *
 *   1. Reflow storm — animated content (d3 force sims, canvas redraws) mutates
 *      the DOM every frame; an unthrottled observer calls `measure()` (which
 *      reads `scrollHeight`, forcing synchronous layout) on every mutation.
 *   2. Feedback loop — writing the observed element's size *inside* the RO
 *      callback re-triggers the observer; if the content tracks the iframe
 *      height (e.g. `min-height: 100vh`) it never converges.
 *
 * The fixes, all verified by iframe-autoresize.test.ts:
 *   - coalesce every firing into a single rAF-scheduled measure,
 *   - skip the write when the height is unchanged (equality guard),
 *   - always defer the write out of the observer callback,
 *   - break runaway growth by disconnecting after N consecutive increases.
 */

const HEIGHT_EPSILON_PX = 2;
const DEFAULT_MAX_GROWTH_STREAK = 24;

export interface IframeAutoResizeOptions {
  iframe: HTMLIFrameElement;
  /** The iframe's contentDocument. */
  doc: Document;
  minHeight: number;
  /** Consecutive height increases tolerated before the resizer gives up. */
  maxGrowthStreak?: number;
  onResize?: (heightPx: number) => void;
  // Injectable seams (default to globals); used by tests for determinism.
  ResizeObserverCtor?: typeof ResizeObserver;
  MutationObserverCtor?: typeof MutationObserver;
  schedule?: (cb: () => void) => number;
  cancel?: (handle: number) => void;
}

export function createIframeAutoResizer(
  options: IframeAutoResizeOptions,
): () => void {
  const {
    iframe,
    doc,
    minHeight,
    maxGrowthStreak = DEFAULT_MAX_GROWTH_STREAK,
    onResize,
  } = options;

  const view = doc.defaultView;
  const ResizeObserverCtor =
    options.ResizeObserverCtor ??
    (view?.ResizeObserver as typeof ResizeObserver | undefined) ??
    (typeof ResizeObserver !== "undefined" ? ResizeObserver : undefined);
  const MutationObserverCtor =
    options.MutationObserverCtor ??
    (view?.MutationObserver as typeof MutationObserver | undefined) ??
    (typeof MutationObserver !== "undefined" ? MutationObserver : undefined);
  const schedule =
    options.schedule ??
    ((cb) =>
      view?.requestAnimationFrame
        ? view.requestAnimationFrame(() => cb())
        : (setTimeout(cb, 16) as unknown as number));
  const cancel =
    options.cancel ??
    ((handle) => {
      if (view?.cancelAnimationFrame) view.cancelAnimationFrame(handle);
      else clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
    });

  let resizeObserver: ResizeObserver | undefined;
  let mutationObserver: MutationObserver | undefined;
  let pendingHandle: number | null = null;
  let lastAppliedHeight = -1;
  let growthStreak = 0;
  let stopped = false;

  const disconnect = () => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = undefined;
    }
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = undefined;
    }
  };

  const measure = (): number => {
    let contentHeight = Math.max(
      doc.documentElement?.scrollHeight ?? 0,
      doc.body?.scrollHeight ?? 0,
      minHeight,
    );
    if (contentHeight <= minHeight && doc.body) {
      const bodyStyle = view?.getComputedStyle(doc.body);
      const explicitMinH = parseInt(bodyStyle?.minHeight ?? "0", 10);
      if (Number.isFinite(explicitMinH) && explicitMinH > contentHeight) {
        contentHeight = explicitMinH;
      }
    }
    return contentHeight;
  };

  const applyHeight = () => {
    if (stopped) return;
    const next = measure();
    if (Math.abs(next - lastAppliedHeight) <= HEIGHT_EPSILON_PX) return;

    if (next > lastAppliedHeight && lastAppliedHeight >= 0) {
      growthStreak += 1;
    } else {
      growthStreak = 0;
    }

    lastAppliedHeight = next;
    iframe.style.height = `${next}px`;
    onResize?.(next);

    // Non-convergence breaker: the content keeps outgrowing the iframe every
    // frame. Freeze at the current height rather than freeze the whole tab.
    if (growthStreak >= maxGrowthStreak) {
      stopped = true;
      disconnect();
    }
  };

  const scheduleMeasure = () => {
    if (stopped || pendingHandle !== null) return;
    pendingHandle = schedule(() => {
      pendingHandle = null;
      applyHeight();
    });
  };

  if (ResizeObserverCtor) {
    resizeObserver = new ResizeObserverCtor(() => scheduleMeasure());
    if (doc.documentElement) resizeObserver.observe(doc.documentElement);
    if (doc.body) resizeObserver.observe(doc.body);
  }
  if (MutationObserverCtor && doc.body) {
    mutationObserver = new MutationObserverCtor(() => scheduleMeasure());
    mutationObserver.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });
  }

  // Initial sizing is scheduled, never written synchronously during setup.
  scheduleMeasure();

  return () => {
    stopped = true;
    if (pendingHandle !== null) {
      cancel(pendingHandle);
      pendingHandle = null;
    }
    disconnect();
  };
}
