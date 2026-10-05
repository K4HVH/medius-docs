import { describe, it, expect, afterEach } from 'vitest';
import { STORE_KEY, createBoxStore } from '../../src/app/pages/dashboard/store';

afterEach(() => localStorage.clear());

const throwing = (): Storage =>
  ({
    getItem: () => {
      throw new DOMException('denied', 'SecurityError');
    },
    setItem: () => {
      throw new DOMException('quota', 'QuotaExceededError');
    },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  }) as Storage;

describe('box store', () => {
  it('starts empty', () => {
    const s = createBoxStore(localStorage);
    expect(s.selected()).toBeNull();
    expect(s.held()).toEqual([]);
  });

  it('survives a reload: what one page writes the next reads', () => {
    const a = createBoxStore(localStorage);
    a.hold('aabbccddeeff', 'Desk');
    a.setSelected('aabbccddeeff');
    const b = createBoxStore(localStorage);
    expect(b.held()).toEqual([{ mac: 'aabbccddeeff', name: 'Desk' }]);
    expect(b.selected()).toBe('aabbccddeeff');
  });

  it('holding a box twice keeps one record, with the newer name', () => {
    const s = createBoxStore(localStorage);
    s.hold('aabbccddeeff', 'Desk');
    s.hold('112233445566', 'Spare');
    s.hold('aabbccddeeff', 'Left');
    expect(s.held()).toEqual([
      { mac: 'aabbccddeeff', name: 'Left' },
      { mac: '112233445566', name: 'Spare' },
    ]);
  });

  it('release forgets the box and nothing else', () => {
    const s = createBoxStore(localStorage);
    s.hold('aabbccddeeff', 'Desk');
    s.hold('112233445566', 'Spare');
    s.release('aabbccddeeff');
    expect(createBoxStore(localStorage).held()).toEqual([{ mac: '112233445566', name: 'Spare' }]);
  });

  it('reads anything it did not write as empty', () => {
    for (const bad of ['{', '"x"', '[1,2]', '{"held":"no","selected":7}', '{"held":[{"mac":3}]}']) {
      localStorage.setItem(STORE_KEY, bad);
      const s = createBoxStore(localStorage);
      expect(s.held()).toEqual([]);
      expect(s.selected()).toBeNull();
    }
  });

  it('storage that throws leaves a store that works for this page', () => {
    const s = createBoxStore(throwing());
    s.hold('aabbccddeeff', 'Desk');
    s.setSelected('aabbccddeeff');
    expect(s.held()).toEqual([{ mac: 'aabbccddeeff', name: 'Desk' }]);
    expect(s.selected()).toBe('aabbccddeeff');
  });

  it('works with no storage at all', () => {
    const s = createBoxStore(null);
    s.hold('aabbccddeeff', 'Desk');
    expect(s.held()).toHaveLength(1);
  });

  it('keeps an icon per box across a reload, and Box puts the default back', () => {
    const a = createBoxStore(localStorage);
    a.setIcon('aabbccddeeff', 'mouse');
    a.setIcon('112233445566', 'usb');
    const b = createBoxStore(localStorage);
    expect(b.icons()).toEqual({ aabbccddeeff: 'mouse', '112233445566': 'usb' });
    b.setIcon('aabbccddeeff', 'box');
    expect(createBoxStore(localStorage).icons()).toEqual({ '112233445566': 'usb' });
    expect(localStorage.getItem(STORE_KEY)).not.toContain('aabbccddeeff');
  });

  it('holding, releasing and selecting a box keep every icon', () => {
    const s = createBoxStore(localStorage);
    s.setIcon('aabbccddeeff', 'controller');
    s.hold('aabbccddeeff', 'Desk');
    s.setSelected('aabbccddeeff');
    s.release('aabbccddeeff');
    expect(createBoxStore(localStorage).icons()).toEqual({ aabbccddeeff: 'controller' });
  });

  it('reads icons it did not write as none, and keeps the boxes beside them', () => {
    for (const icons of ['"x"', '[1]', '{"aabbccddeeff":"toaster"}', '{"aabbccddeeff":3}', '{"aabbccddeeff":"box"}']) {
      localStorage.setItem(STORE_KEY, `{"selected":"aabbccddeeff","held":[{"mac":"aabbccddeeff","name":"Desk"}],"icons":${icons}}`);
      const s = createBoxStore(localStorage);
      expect(s.icons()).toEqual({});
      expect(s.held()).toEqual([{ mac: 'aabbccddeeff', name: 'Desk' }]);
    }
    localStorage.setItem(STORE_KEY, '{"icons":{"aabbccddeeff":"mouse","112233445566":"toaster"}}');
    expect(createBoxStore(localStorage).icons()).toEqual({ aabbccddeeff: 'mouse' });
  });

  it('an icon set with storage that throws lasts for this page', () => {
    const s = createBoxStore(throwing());
    s.setIcon('aabbccddeeff', 'mouse');
    expect(s.icons()).toEqual({ aabbccddeeff: 'mouse' });
  });

  it('storage that reads but will not write keeps what this page set', () => {
    const full = {
      getItem: (k: string) => localStorage.getItem(k),
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
    } as unknown as Storage;
    localStorage.setItem(STORE_KEY, '{"held":[{"mac":"aabbccddeeff","name":"Desk"}]}');
    const s = createBoxStore(full);
    s.setIcon('aabbccddeeff', 'mouse');
    s.setSelected('aabbccddeeff');
    expect(s.icons()).toEqual({ aabbccddeeff: 'mouse' });
    expect(s.selected()).toBe('aabbccddeeff');
    expect(s.held()).toEqual([{ mac: 'aabbccddeeff', name: 'Desk' }]);
  });

  it("two tabs keep each other's boxes: each change is made to what is stored now", () => {
    const a = createBoxStore(localStorage);
    const b = createBoxStore(localStorage);
    a.hold('aabbccddeeff', 'Desk');
    b.hold('112233445566', 'Spare');
    b.setSelected('112233445566');
    expect(a.held().map((h) => h.mac)).toEqual(['aabbccddeeff', '112233445566']);
    a.release('112233445566');
    expect(b.held().map((h) => h.mac)).toEqual(['aabbccddeeff']);
    expect(a.selected()).toBe('112233445566');
  });
});
