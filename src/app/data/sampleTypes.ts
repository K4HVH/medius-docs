// The shapes medius-fw's tools/rig/descriptor_capture.py and feed_capture.py write.

export interface DescriptorField {
  field: string;
  mouse: string;
  clone: string;
}

export interface DescriptorSample {
  device: string;
  vidpid: string;
  firmware: string;
  captured: string;
  descriptors: Record<'device' | 'configuration' | 'interface' | 'hid' | 'endpoint', DescriptorField[]>;
}

export interface FeedFrame {
  frame: number;
  ep: string | null;
  report: string | null;
  mouse: boolean;
  api: boolean[];
}

export interface FeedSample {
  device: string;
  vidpid: string;
  firmware: string;
  captured: string;
  frames: FeedFrame[];
}
