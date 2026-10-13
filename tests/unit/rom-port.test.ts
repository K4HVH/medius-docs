import { describe, it, expect, vi } from 'vitest';
import { RomPort } from '../../src/dashboard/flash/rom/port';
import { slipEncode } from '../../src/dashboard/flash/rom/slip';

// A Web Serial port whose far end the test plays: what it sends, what it read, its signals and its state.
function fakePort() {
  let into!: ReadableStreamDefaultController<Uint8Array>;
  const written: number[] = [];
  const state = { opened: 0, closed: 0, signals: [] as SerialOutputSignals[], baud: 0 };
  const port = {
    readable: new ReadableStream<Uint8Array>({ start: (c) => void (into = c) }),
    writable: new WritableStream<Uint8Array>({ write: (b) => void written.push(...b) }),
    async open(o: SerialOptions) {
      state.opened++;
      state.baud = o.baudRate;
    },
    async close() {
      state.closed++;
    },
    async setSignals(s: SerialOutputSignals) {
      state.signals.push(s);
    },
  };
  return { port: port as unknown as SerialPort, send: (b: Uint8Array) => into.enqueue(b), lose: (e: Error) => into.error(e), written, state };
}

describe('RomPort', () => {
  it('opens the port, and returns each frame the chip sends', async () => {
    const f = fakePort();
    const p = await RomPort.open(f.port);
    expect(f.state).toMatchObject({ opened: 1, baud: 115200 });
    f.send(new Uint8Array([...slipEncode(new Uint8Array([1, 2])), ...slipEncode(new Uint8Array([3]))]));
    expect([...(await p.next(500))]).toEqual([1, 2]);
    expect([...(await p.next(500))]).toEqual([3]);
    await p.close();
  });

  it('writes one SLIP frame per send', async () => {
    const f = fakePort();
    const p = await RomPort.open(f.port);
    await p.send(new Uint8Array([0xc0]));
    expect(f.written).toEqual([0xc0, 0xdb, 0xdc, 0xc0]);
    await p.close();
  });

  it('says the chip stopped answering when no frame comes in time', async () => {
    const f = fakePort();
    const p = await RomPort.open(f.port);
    await expect(p.next(30)).rejects.toThrow('The chip stopped answering.');
    await p.close();
  });

  it('ends a wait at once with the error of a device that went away', async () => {
    const f = fakePort();
    const p = await RomPort.open(f.port);
    const waiting = p.next(60_000);
    const t0 = Date.now();
    f.lose(new DOMException('The device has been lost.', 'NetworkError'));
    await expect(waiting).rejects.toThrow('The device has been lost.');
    await expect(p.next(60_000)).rejects.toThrow('The device has been lost.');
    expect(Date.now() - t0).toBeLessThan(1000);
    await p.close();
  });

  it('fails a send the chip never takes, as a chip that stopped answering', async () => {
    const f = fakePort();
    (f.port as unknown as { writable: WritableStream<Uint8Array> }).writable = new WritableStream({ write: () => new Promise(() => {}) });
    const p = await RomPort.open(f.port);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const sent = expect(p.send(new Uint8Array([1]))).rejects.toThrow('The chip stopped answering.');
    await vi.advanceTimersByTimeAsync(4000);
    await sent;
    vi.useRealTimers();
    await p.close();
    expect(f.state.closed).toBe(1);
  });

  it('refuses a second wait while one is pending', async () => {
    const f = fakePort();
    const p = await RomPort.open(f.port);
    const first = p.next(500);
    await expect(p.next(500)).rejects.toThrow();
    f.send(slipEncode(new Uint8Array([6])));
    expect([...(await first)]).toEqual([6]);
    await p.close();
  });

  it('closes the port when it cannot take its streams', async () => {
    const f = fakePort();
    (f.port as unknown as { readable: unknown }).readable = { getReader: () => { throw new TypeError('locked'); } };
    await expect(RomPort.open(f.port)).rejects.toThrow('locked');
    expect(f.state.closed).toBe(1);
  });

  it('ends a wait when the port closes partway through', async () => {
    const f = fakePort();
    const p = await RomPort.open(f.port);
    const waiting = p.next(60_000);
    await p.close();
    await expect(waiting).rejects.toThrow('The port closed partway through.');
  });

  it('drops frames that came before a drain', async () => {
    const f = fakePort();
    const p = await RomPort.open(f.port);
    f.send(slipEncode(new Uint8Array([9])));
    await new Promise((r) => setTimeout(r, 10));
    p.drain();
    f.send(slipEncode(new Uint8Array([4])));
    expect([...(await p.next(500))]).toEqual([4]);
    await p.close();
  });

  it('sets the signals it is given, and closes the port once', async () => {
    const f = fakePort();
    const p = await RomPort.open(f.port);
    await p.signals({ requestToSend: true });
    await p.close();
    await p.close();
    expect(f.state.signals).toEqual([{ requestToSend: true }]);
    expect(f.state.closed).toBe(1);
  });
});
