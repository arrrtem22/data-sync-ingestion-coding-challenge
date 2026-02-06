import { describe, it, expect, beforeEach } from 'vitest';
import { Metrics } from '../src/core/metrics';

describe('Metrics', () => {
  let metrics: Metrics;

  beforeEach(() => {
    metrics = new Metrics();
  });

  it('should increment counters', () => {
    metrics.increment('test_counter', 1);
    metrics.increment('test_counter', 2);
    const snapshot = metrics.getSnapshot();
    expect(snapshot.test_counter).toBe(3);
  });

  it('should track timing', () => {
    metrics.timing('test_latency', 100);
    const snapshot = metrics.getSnapshot();
    expect(snapshot.test_latency_sum).toBe(100);
    expect(snapshot.test_latency_count).toBe(1);
  });
});
