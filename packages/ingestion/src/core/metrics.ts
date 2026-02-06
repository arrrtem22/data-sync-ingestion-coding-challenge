export class Metrics {
  private metrics: Map<string, number> = new Map();
  private startTime: number = Date.now();

  increment(metric: string, value: number = 1) {
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, current + value);
  }

  timing(metric: string, durationMs: number) {
    const sumKey = `${metric}_sum`;
    const countKey = `${metric}_count`;
    this.increment(sumKey, durationMs);
    this.increment(countKey, 1);
  }

  getSnapshot() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const totalEvents = this.metrics.get('events_ingested') || 0;
    const avgEventsPerSec = elapsed > 0 ? totalEvents / elapsed : 0;
    
    return {
      ...Object.fromEntries(this.metrics),
      uptime_sec: elapsed,
      events_per_sec: avgEventsPerSec
    };
  }
}

export const metrics = new Metrics();
