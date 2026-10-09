export type Verdict = 'works' | 'partial' | 'doesnt';

export interface CompatEntry {
  name: string;
  kind: 'mouse' | 'keyboard' | 'other';
  verdict: Verdict;
  note?: string;
  vidpid?: string;
  // The latest release on the day of the report.
  reported?: string;
}

export const VERDICT_LABEL: Record<Verdict, string> = { works: 'Supported', partial: 'Partial', doesnt: 'Unsupported' };
// The status lamp's colour.
export const VERDICT_TONE: Record<Verdict, string> = { works: 'ok', partial: 'warn', doesnt: 'bad' };
export const KIND_LABEL: Record<CompatEntry['kind'], string> = { mouse: 'Mouse', keyboard: 'Keyboard', other: 'Other' };

// Owners' reports from the Discord #compatibility channel, newest report first where two disagree, and a
// release that names a device over a report that predates it. Names follow the maker's spelling.
export const COMPAT: readonly CompatEntry[] = [
  { name: 'Ace 68 Pro', kind: 'keyboard', verdict: 'doesnt', reported: 'v3.0.1' },
  { name: 'Ajazz AJ159 APEX', kind: 'mouse', verdict: 'works', reported: 'v3.0.1' },
  { name: 'ATK 68 RX', kind: 'keyboard', verdict: 'doesnt', reported: 'v2.3.2' },
  { name: 'ATK A9 Ultimate', kind: 'mouse', verdict: 'works', reported: 'v2.3.2' },
  { name: 'ATK Y9 Ultimate', kind: 'mouse', verdict: 'works', reported: 'v3.2.0' },
  { name: 'ATK Zero 8K', kind: 'mouse', verdict: 'works', reported: 'v2.2.1' },
  { name: 'Attack Shark R5 Ultra', kind: 'mouse', verdict: 'partial', note: "Over wireless, the vendor's app can't see it", reported: 'v3.0.1' },
  { name: 'Attack Shark V3 PRO', kind: 'mouse', verdict: 'works', reported: 'v3.1.0' },
  { name: 'Attack Shark X3', kind: 'mouse', verdict: 'works', reported: 'v3.2.1' },
  { name: 'Attack Shark X8SE', kind: 'mouse', verdict: 'works', reported: 'v3.2.0' },
  { name: 'AULA SC580', kind: 'mouse', verdict: 'works', reported: 'v3.3.4' },
  { name: 'AULA SC800', kind: 'mouse', verdict: 'works', reported: 'v3.3.4' },
  { name: 'AULA SC900 Pro', kind: 'mouse', verdict: 'works', reported: 'v3.3.4' },
  { name: 'Corsair SABRE PRO Champion Series', kind: 'mouse', verdict: 'works', reported: 'v3.0.1' },
  { name: 'Endgame Gear OP1 8k', kind: 'mouse', verdict: 'works', reported: 'v3.1.0' },
  { name: 'Endgame Gear OP1 8k v2', kind: 'mouse', verdict: 'works', reported: 'v3.1.0' },
  { name: 'Endgame Gear OP1w 4k v2', kind: 'mouse', verdict: 'works', reported: 'v3.0.1' },
  { name: 'G-Wolves Lycan', kind: 'mouse', verdict: 'works', reported: 'v3.0.1' },
  { name: 'G-Wolves Vuk', kind: 'mouse', verdict: 'works', reported: 'v3.0.1' },
  { name: 'GK61', kind: 'keyboard', verdict: 'works', reported: 'v2.3.2' },
  { name: 'Glorious Model O- Wireless', kind: 'mouse', verdict: 'works', reported: 'v3.0.1' },
  { name: 'Glorious Model O3', kind: 'mouse', verdict: 'partial', note: "Works wired at 1000 Hz; wireless doesn't", reported: 'v3.0.1' },
  { name: 'HyperX Pulsefire', kind: 'mouse', verdict: 'doesnt', reported: 'v3.4.1' },
  { name: 'IQUNIX EV63', kind: 'keyboard', verdict: 'partial', note: "Keystrokes don't reach software properly", reported: 'v3.3.4' },
  { name: 'Keychron Q1 HE', kind: 'keyboard', verdict: 'works', reported: 'v3.3.4' },
  { name: 'Kysona M600', kind: 'mouse', verdict: 'works', reported: 'v3.4.2' },
  { name: 'LAMZU Atlantis Mini', kind: 'mouse', verdict: 'works', reported: 'v3.1.0' },
  { name: 'LAMZU Atlantis V2', kind: 'mouse', verdict: 'works', reported: 'v3.1.0' },
  { name: 'LAMZU Maya 8K Champion Edition', kind: 'mouse', verdict: 'works', reported: 'v3.2.1' },
  { name: 'LAMZU Maya X 8K', kind: 'mouse', verdict: 'works', reported: 'v3.0.1' },
  { name: 'Lenovo KB317W', kind: 'keyboard', verdict: 'works', reported: 'v2.2.0' },
  { name: 'Lenovo MA204W', kind: 'mouse', verdict: 'works', reported: 'v2.2.0' },
  { name: 'Logitech G PRO X', kind: 'mouse', verdict: 'works', reported: 'v3.1.0' },
  { name: 'Logitech G PRO X SUPERLIGHT', kind: 'mouse', verdict: 'works', reported: 'v3.2.1' },
  { name: 'Logitech G PRO X SUPERLIGHT 2', kind: 'mouse', verdict: 'works', note: 'Runs at 125 Hz without imperfect clone and the wire rate forced to 1000 Hz', reported: 'v3.3.4' },
  { name: 'Logitech G PRO X2 SUPERSTRIKE', kind: 'mouse', verdict: 'works', note: 'Wireless needs imperfect clone and the wire rate forced to 1000 Hz', reported: 'v3.4.2' },
  { name: 'Logitech G402', kind: 'mouse', verdict: 'works', reported: 'v2.2.0' },
  { name: 'Logitech G502 HERO', kind: 'mouse', verdict: 'works', vidpid: '046d:c08b', reported: 'v2.2.0' },
  { name: 'Logitech G502 X LIGHTSPEED', kind: 'mouse', verdict: 'works', reported: 'v2.2.0' },
  { name: 'Logitech K270', kind: 'keyboard', verdict: 'works', reported: 'v2.2.0' },
  { name: 'Logitech M185', kind: 'mouse', verdict: 'works', reported: 'v2.2.0' },
  { name: 'Logitech POWERPLAY', kind: 'other', verdict: 'works', reported: 'v2.2.0' },
  { name: 'MCHOSE G3 V2', kind: 'mouse', verdict: 'works', reported: 'v3.4.1' },
  { name: 'Nextech XC5146', kind: 'keyboard', verdict: 'works', reported: 'v2.2.0' },
  { name: 'Ninjutso Sora V2', kind: 'mouse', verdict: 'works', reported: 'v3.2.1' },
  { name: 'Pulsar X2 CrazyLight', kind: 'mouse', verdict: 'works', reported: 'v3.1.0' },
  { name: 'Pulsar X2H CrazyLight', kind: 'mouse', verdict: 'works', reported: 'v3.2.1' },
  { name: 'Razer BlackWidow Chroma V2', kind: 'keyboard', verdict: 'works', reported: 'v2.2.0' },
  { name: 'Razer Cobra', kind: 'mouse', verdict: 'works', reported: 'v3.4.1' },
  { name: 'Razer DeathAdder Essential', kind: 'mouse', verdict: 'works', reported: 'v3.1.0' },
  { name: 'Razer DeathAdder V3 Pro', kind: 'mouse', verdict: 'works', reported: 'v3.0.1' },
  { name: 'Razer Huntsman Elite', kind: 'keyboard', verdict: 'works', reported: 'v2.2.0' },
  { name: 'Razer Mamba Elite', kind: 'mouse', verdict: 'works', reported: 'v2.2.0' },
  { name: 'Razer Viper Mini', kind: 'mouse', verdict: 'works', reported: 'v3.0.1' },
  { name: 'Razer Viper Mini SE', kind: 'mouse', verdict: 'works', reported: 'v3.0.1' },
  { name: 'Razer Viper V3 Pro', kind: 'mouse', verdict: 'works', vidpid: '1532:00c1', reported: 'v3.0.1' },
  { name: 'Razer Viper V4 Pro', kind: 'mouse', verdict: 'works', reported: 'v3.0.1' },
  { name: 'Scyrox V6', kind: 'mouse', verdict: 'works', reported: 'v3.0.1' },
  { name: 'SteelSeries Rival 3', kind: 'mouse', verdict: 'works', reported: 'v3.2.1' },
  { name: 'Swiftpoint Z3', kind: 'mouse', verdict: 'works', reported: 'v3.0.1' },
  { name: 'Vaxee XE Wireless', kind: 'mouse', verdict: 'works', reported: 'v3.1.0' },
  { name: 'VXE R1 NearLink', kind: 'mouse', verdict: 'works', reported: 'v3.2.1' },
  { name: 'VXE R1 Pro', kind: 'mouse', verdict: 'works', reported: 'v3.2.1' },
  { name: 'Wooting 60HE+', kind: 'keyboard', verdict: 'works', note: 'Needs imperfect clone', vidpid: '31e3:1322', reported: 'v3.4.4' },
  { name: 'Wooting Two HE', kind: 'keyboard', verdict: 'works', note: 'Needs imperfect clone', reported: 'v3.4.4' },
  { name: 'Zaopin Z1 Pro Max', kind: 'mouse', verdict: 'partial', note: "Works wired; wireless doesn't", reported: 'v3.4.1' },
];
