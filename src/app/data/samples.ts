import descriptor from './descriptorSample.json';
import feed from './feedSample.json';
import type { DescriptorSample, FeedSample } from './sampleTypes';

// Captured on the bench by medius-fw's tools/rig/descriptor_capture.py and feed_capture.py.
export const DESCRIPTOR_SAMPLE = descriptor as DescriptorSample;
export const FEED_SAMPLE = feed as FeedSample;
