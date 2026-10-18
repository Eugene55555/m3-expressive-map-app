import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const notify = vi.hoisted(() => vi.fn());

vi.mock('../src/ui/dialogs.ts', () => ({
  confirmDialog: vi.fn(),
  notify,
}));

import { M3App } from '../src/ui/app.ts';

describe('voice search unavailable notification', () => {
  let element: M3App;

  beforeEach(() => {
    notify.mockClear();
    element = new M3App();
    document.body.append(element);
  });

  afterEach(() => {
    element.remove();
  });

  it('notifies the user when the search bar reports no speech support', () => {
    element.dispatchEvent(
      new CustomEvent('speech-unavailable', { bubbles: true, composed: true }),
    );

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toMatch(/voice search/i);
  });
});
