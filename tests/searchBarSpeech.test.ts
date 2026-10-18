import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../src/ui/search-bar.ts';
import { M3SearchBar } from '../src/ui/search-bar.ts';

class ThrowingSpeechRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult = null;
  onerror = null;
  onend = null;
  onstart = null;

  start(): void {
    throw new Error('engine failed to start');
  }

  stop(): void {}

  abort(): void {}
}

describe('search bar with a speech engine whose start() throws', () => {
  let element: M3SearchBar;
  let notifyListener: EventListener;
  let notifyCalls: CustomEvent[];

  beforeEach(() => {
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
      ThrowingSpeechRecognition;
    element = new M3SearchBar();
    notifyCalls = [];
    notifyListener = (event) => notifyCalls.push(event as CustomEvent);
    element.addEventListener('app-notify', notifyListener);
    element.addEventListener('speech-unavailable', notifyListener);
    document.body.append(element);
  });

  afterEach(() => {
    element.remove();
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  });

  it('stays not-listening, notifies, and does not claim missing support', async () => {
    await element.updateComplete;
    element.querySelector('.search-bar__mic')!.dispatchEvent(new Event('click'));
    await element.updateComplete;

    const eventTypes = notifyCalls.map((event) => event.type);

    expect(eventTypes).toContain('app-notify');
    expect(eventTypes).not.toContain('speech-unavailable');
    expect(notifyCalls.find((event) => event.type === 'app-notify')?.detail ?? {}).toHaveProperty(
      'message',
      'Voice search could not start.',
    );
    expect((element as unknown as { listening: boolean }).listening).toBe(false);
  });
});
