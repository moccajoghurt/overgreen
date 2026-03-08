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

  register(label: string, category: string): void {
    this.entries.set(label, { label, category, avgMs: 0, lastStart: 0 });
    this.order.push(label);
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

  getFps(): number {
    const f = this.entries.get('frame');
    return f && f.avgMs > 0 ? 1000 / f.avgMs : 0;
  }

  getFrameMs(): number {
    return this.entries.get('frame')?.avgMs ?? 0;
  }
}
