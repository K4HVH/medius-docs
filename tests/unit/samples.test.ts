import { describe, it, expect } from 'vitest';
import { DESCRIPTOR_SAMPLE, FEED_SAMPLE } from '../../src/app/data/samples';

const bytes = (hex: string) => hex.split(' ').length;

describe('descriptor sample', () => {
  it('matches the mouse byte for byte in every field', () => {
    for (const rows of Object.values(DESCRIPTOR_SAMPLE.descriptors)) {
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(r.mouse).toMatch(/^[0-9A-F]{2}( [0-9A-F]{2})*$/);
        expect(r.clone).toBe(r.mouse);
      }
    }
  });

  it('holds each descriptor whole', () => {
    const total = (k: keyof typeof DESCRIPTOR_SAMPLE.descriptors) =>
      DESCRIPTOR_SAMPLE.descriptors[k].reduce((s, r) => s + bytes(r.mouse), 0);
    expect([total('device'), total('configuration'), total('interface'), total('hid'), total('endpoint')]).toEqual([
      18, 9, 9, 9, 7,
    ]);
  });

  it('names the device, its ids, the firmware and the day', () => {
    expect(DESCRIPTOR_SAMPLE.device).not.toBe('');
    expect(DESCRIPTOR_SAMPLE.vidpid).toMatch(/^[0-9a-f]{4}:[0-9a-f]{4}$/);
    expect(DESCRIPTOR_SAMPLE.firmware).toMatch(/^\d+\.\d+\.\d+$/);
    expect(DESCRIPTOR_SAMPLE.captured).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('feed sample', () => {
  const frames = FEED_SAMPLE.frames;
  const taken = frames.filter((f) => f.report);

  it('runs frame by frame from 0', () => {
    expect(frames.length).toBeGreaterThanOrEqual(200);
    frames.forEach((f, i) => expect(f.frame).toBe(i));
  });

  it('has one report length, with a mark for every byte', () => {
    const len = taken[0].report!.length;
    for (const f of taken) {
      expect(f.report).toMatch(/^([0-9A-F]{2})+$/);
      expect(f.report!.length).toBe(len);
      expect(f.api).toHaveLength(len / 2);
    }
    for (const f of frames.filter((x) => !x.report)) expect(f.api).toEqual([]);
  });

  it('carries native motion and injected bursts', () => {
    expect(frames.filter((f) => f.mouse).length).toBeGreaterThan(frames.length / 2);
    expect(frames.filter((f) => f.api.some(Boolean)).length).toBeGreaterThanOrEqual(8);
  });
});
