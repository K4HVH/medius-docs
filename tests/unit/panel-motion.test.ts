import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openPanels } from '../../src/app/shell/panelMotion';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(() => [{}] as unknown as DOMRectList);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({ top: 0, bottom: 10, left: 0, right: 0, width: 0, height: 10, x: 0, y: 0, toJSON: () => ({}) }));
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('openPanels', () => {
  it('leaves a panel drawn again unchanged still, and brings in only what changed in one that kept its frame', () => {
    document.body.innerHTML = `<section class="pane">
      <div class="pn" data-still="all"><div class="ph">Status</div><div class="pb"><p>Linked</p></div></div>
      <div class="pn" data-still="frame"><div class="ph">Your box</div><div class="pb"><p>Desk</p></div></div>
      <div class="pn"><div class="ph">Performance</div><div class="pb"><p>1000 Hz</p></div></div>
    </section>`;
    openPanels(document.querySelector<HTMLElement>('.pane')!);
    const moving = [...document.querySelectorAll('.moving')].map((el) => el.textContent);
    expect(moving).toEqual(['Desk', 'Performance', '1000 Hz']);
  });
});
