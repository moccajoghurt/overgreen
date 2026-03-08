/** Timing hooks interface — the only thing simulation.ts imports (as `import type`). */
export interface TimingHooks {
  begin(label: string): void;
  end(label: string): void;
}

interface PerfEntry {
  label: string;
  category: string;
  avgMs: number;
  lastStart: number;
}

export class PerfTracker implements TimingHooks {
  private entries = new Map<string, PerfEntry>();
  private order: string[] = [];
  private lastFrameTime = 0;
  private frameIntervalMs = 0; // EMA of wall-clock time between frames

  register(label: string, category: string): void {
    this.entries.set(label, { label, category, avgMs: 0, lastStart: 0 });
    this.order.push(label);
  }

  /** Call once per frame with the RAF timestamp to track real frame-to-frame interval. */
  markFrame(now: number): void {
    if (this.lastFrameTime > 0) {
      const dt = now - this.lastFrameTime;
      this.frameIntervalMs += (dt - this.frameIntervalMs) * 0.1;
    }
    this.lastFrameTime = now;
  }

  begin(label: string): void {
    const e = this.entries.get(label);
    if (e) e.lastStart = performance.now();
  }

  end(label: string): void {
    const e = this.entries.get(label);
    if (e) {
      const dt = performance.now() - e.lastStart;
      e.avgMs += (dt - e.avgMs) * 0.1;
    }
  }

  getEntries(): { label: string; category: string; avgMs: number }[] {
    const out: { label: string; category: string; avgMs: number }[] = [];
    for (const key of this.order) {
      const e = this.entries.get(key)!;
      out.push({ label: e.label, category: e.category, avgMs: e.avgMs });
    }
    return out;
  }

  /** Real FPS based on wall-clock frame-to-frame interval. */
  getFps(): number {
    return this.frameIntervalMs > 0 ? 1000 / this.frameIntervalMs : 0;
  }

  /** Wall-clock frame-to-frame interval (ms). */
  getFrameMs(): number {
    return this.frameIntervalMs;
  }

  /** CPU-side work time for a frame (ms). */
  getFrameWorkMs(): number {
    return this.entries.get('frame')?.avgMs ?? 0;
  }
}
