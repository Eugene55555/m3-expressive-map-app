import { describe, expect, it } from 'vitest';
import { tooltipContent } from '../src/ui/map.ts';

describe('map tooltip content', () => {
  it('renders an untrusted name as literal text, not HTML', () => {
    const name = '<img src=x onerror=alert(1)>';
    const el = tooltipContent(name);

    expect(el.textContent).toBe(name);
    expect(el.querySelector('img')).toBeNull();
    expect(el.innerHTML).not.toContain('<img');
  });

  it('does not create child elements for malicious names', () => {
    const name = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    const el = tooltipContent(name);

    expect(el.textContent).toBe(name);
    expect(el.children).toHaveLength(0);
  });
});
