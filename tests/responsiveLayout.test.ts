import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appCss = readFileSync(resolve(process.cwd(), 'src/styles/app.css'), 'utf8');

describe('responsive app shell layout', () => {
  it('uses one full-width mobile grid track after the navigation rail is hidden', () => {
    const mobileMedia = appCss.match(/@media\s*\(max-width:\s*599px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const appShellRule = mobileMedia.match(/\.app-shell\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(appShellRule).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/);
    expect(appShellRule).not.toMatch(/grid-template-columns:\s*0\s+minmax\(/);
  });
});
