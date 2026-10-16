import { describe, expect, it } from 'vitest';
import { type FirmwareRelease, olderReleases } from '../../src/dashboard/firmware';

const release = (tag: string, prerelease = false): FirmwareRelease => ({ tag, name: tag, publishedAt: '2026-10-05T12:00:00Z', prerelease, notes: '', assets: [] });

describe('olderReleases', () => {
  it('lists every release after the latest back to v3.2.0, newest first', () => {
    const list = ['v3.4.5', 'v3.4.4', 'v3.3.2', 'v3.2.1', 'v3.2.0', 'v3.1.0', 'v2.3.2', 'v0.1.0'].map((t) => release(t));
    expect(olderReleases(list).map((r) => r.tag)).toEqual(['v3.4.4', 'v3.3.2', 'v3.2.1', 'v3.2.0']);
  });

  it('leaves out v3.3.1, which stops before it starts on a box without PSRAM', () => {
    const list = ['v3.4.5', 'v3.3.2', 'v3.3.1', 'v3.2.1'].map((t) => release(t));
    expect(olderReleases(list).map((r) => r.tag)).toEqual(['v3.3.2', 'v3.2.1']);
  });

  it('leaves out prereleases and tags that name no version', () => {
    const list = [release('v3.4.5'), release('v3.4.4', true), release('nightly'), release('v3.3.2')];
    expect(olderReleases(list).map((r) => r.tag)).toEqual(['v3.3.2']);
  });

  it('is empty with no list or only the latest', () => {
    expect(olderReleases(undefined)).toEqual([]);
    expect(olderReleases([release('v3.4.5')])).toEqual([]);
  });
});
