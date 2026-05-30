// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIframeAutoResizer } from "./iframe-autoresize";

/**
 * Controllable fakes: jsdom has no ResizeObserver/MutationObserver and never
 * lays out, so we inject observers we can fire on demand and a document whose
 * scrollHeight we control. This lets us assert the *scheduling and convergence*
 * contract deterministically.
 */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  cb: () => void;
  observed: unknown[] = [];
  disconnected = false;
  constructor(cb: () => void) {
    this.cb = cb;
    FakeResizeObserver.instances.push(this);
  }
  observe(t: unknown) {
    this.observed.push(t);
  }
  disconnect() {
    this.disconnected = true;
  }
  fire() {
    this.cb();
  }
}

class FakeMutationObserver {
  static instances: FakeMutationObserver[] = [];
  cb: () => void;
  disconnected = false;
  constructor(cb: () => void) {
    this.cb = cb;
    FakeMutationObserver.instances.push(this);
  }
  observe() {}
  disconnect() {
    this.disconnected = true;
  }
  fire() {
    this.cb();
  }
}

function makeFakeDoc(getHeight: () => number): Document {
  const make = () =>
    ({
      get scrollHeight() {
        return getHeight();
      },
    }) as unknown as HTMLElement;
  const docEl = make();
  const body = make();
  return {
    documentElement: docEl,
    body,
    defaultView: { getComputedStyle: () => ({ minHeight: "0" }) },
  } as unknown as Document;
}

// Manual scheduler so we control when coalesced measures run.
function makeScheduler() {
  const queue: Array<() => void> = [];
  return {
    schedule: (cb: () => void): number => {
      queue.push(cb);
      return queue.length;
    },
    cancel: () => {},
    flush: () => {
      const pending = queue.splice(0, queue.length);
      for (const cb of pending) cb();
    },
    size: () => queue.length,
  };
}

let iframe: HTMLIFrameElement;

beforeEach(() => {
  FakeResizeObserver.instances = [];
  FakeMutationObserver.instances = [];
  iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
});

afterEach(() => {
  iframe.remove();
});

describe("createIframeAutoResizer", () => {
  it("coalesces many observer firings into a single height write per frame", () => {
    let height = 500;
    const onResize = vi.fn();
    const sched = makeScheduler();
    const cleanup = createIframeAutoResizer({
      iframe,
      doc: makeFakeDoc(() => height),
      minHeight: 400,
      onResize,
      ResizeObserverCtor: FakeResizeObserver as unknown as typeof ResizeObserver,
      MutationObserverCtor:
        FakeMutationObserver as unknown as typeof MutationObserver,
      schedule: sched.schedule,
      cancel: sched.cancel,
    });

    // Initial measure is scheduled, not run synchronously (no write inside setup).
    expect(onResize).not.toHaveBeenCalled();

    const ro = FakeResizeObserver.instances[0];
    // Fire the observer 50 times before any frame runs.
    for (let i = 0; i < 50; i++) ro.fire();
    // Despite 50 firings + initial, only ONE measure is queued (coalesced).
    expect(sched.size()).toBe(1);

    sched.flush();
    expect(onResize).toHaveBeenCalledTimes(1);
    expect(onResize).toHaveBeenLastCalledWith(500);
    expect(iframe.style.height).toBe("500px");

    cleanup();
  });

  it("does not write again when content height is unchanged (equality guard)", () => {
    let height = 600;
    const onResize = vi.fn();
    const sched = makeScheduler();
    const cleanup = createIframeAutoResizer({
      iframe,
      doc: makeFakeDoc(() => height),
      minHeight: 400,
      onResize,
      ResizeObserverCtor: FakeResizeObserver as unknown as typeof ResizeObserver,
      MutationObserverCtor:
        FakeMutationObserver as unknown as typeof MutationObserver,
      schedule: sched.schedule,
      cancel: sched.cancel,
    });
    sched.flush();
    expect(onResize).toHaveBeenCalledTimes(1);

    const ro = FakeResizeObserver.instances[0];
    // Steady state: fire again, height unchanged → no second write.
    ro.fire();
    sched.flush();
    expect(onResize).toHaveBeenCalledTimes(1);

    // Sub-pixel jitter under threshold is also ignored.
    height = 601;
    ro.fire();
    sched.flush();
    expect(onResize).toHaveBeenCalledTimes(1);

    // Real change writes.
    height = 800;
    ro.fire();
    sched.flush();
    expect(onResize).toHaveBeenCalledTimes(2);
    expect(onResize).toHaveBeenLastCalledWith(800);

    cleanup();
  });

  it("never writes height synchronously inside the ResizeObserver callback", () => {
    let height = 500;
    const sched = makeScheduler();
    const cleanup = createIframeAutoResizer({
      iframe,
      doc: makeFakeDoc(() => height),
      minHeight: 400,
      ResizeObserverCtor: FakeResizeObserver as unknown as typeof ResizeObserver,
      MutationObserverCtor:
        FakeMutationObserver as unknown as typeof MutationObserver,
      schedule: sched.schedule,
      cancel: sched.cancel,
    });
    const ro = FakeResizeObserver.instances[0];
    height = 900;
    ro.fire();
    // Write must be deferred to the scheduler, not applied during the callback.
    expect(iframe.style.height).toBe("");
    sched.flush();
    expect(iframe.style.height).toBe("900px");
    cleanup();
  });

  it("breaks runaway growth feedback loops by disconnecting observers", () => {
    // Pathological iframe: content is always 20px taller than whatever we set,
    // i.e. a non-converging measure→resize→measure loop.
    let applied = 400;
    const onResize = vi.fn((h: number) => {
      applied = h;
    });
    const sched = makeScheduler();
    const cleanup = createIframeAutoResizer({
      iframe,
      doc: makeFakeDoc(() => applied + 20),
      minHeight: 400,
      maxGrowthStreak: 8,
      onResize,
      ResizeObserverCtor: FakeResizeObserver as unknown as typeof ResizeObserver,
      MutationObserverCtor:
        FakeMutationObserver as unknown as typeof MutationObserver,
      schedule: sched.schedule,
      cancel: sched.cancel,
    });
    const ro = FakeResizeObserver.instances[0];
    for (let i = 0; i < 100; i++) {
      ro.fire();
      sched.flush();
    }
    // The breaker stops it long before 100 writes.
    expect(onResize.mock.calls.length).toBeLessThanOrEqual(9);
    expect(ro.disconnected).toBe(true);
    cleanup();
  });
});
