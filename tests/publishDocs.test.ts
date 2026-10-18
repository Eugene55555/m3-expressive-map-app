import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const testsDir = import.meta.url.startsWith('file:')
  ? dirname(fileURLToPath(import.meta.url))
  : import.meta.url;
const repoRoot = dirname(testsDir);
const scriptPath = join(repoRoot, 'scripts', 'publish-docs.mjs');

const workspaces: string[] = [];

function makeWorkspace(distEntries: Record<string, string>): string {
  const workspace = mkdtempSync(join(tmpdir(), 'publish-docs-'));
  workspaces.push(workspace);
  for (const [relative, content] of Object.entries(distEntries)) {
    const full = join(workspace, 'dist', relative);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return workspace;
}

function runPublishScript(workspace: string) {
  // Argument arrays and no shell: the script must run with `cwd` as its root.
  return spawnSync(process.execPath, [scriptPath], {
    cwd: workspace,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, TMPDIR: tmpdir() },
  });
}

afterEach(() => {
  while (workspaces.length > 0) {
    rmSync(workspaces.pop() as string, { recursive: true, force: true });
  }
});

describe('publish-docs safety check', () => {
  it('refuses artifacts with a sensitive file nested below a legitimate directory', () => {
    const workspace = makeWorkspace({
      'index.html': '<!doctype html><title>site</title>',
      'assets/config/.env.production': 'SECRET=1',
    });

    const result = runPublishScript(workspace);

    // No copying must happen when the artifact is rejected.
    expect(result.status, `${result.stdout}\n${result.stderr}`).not.toBe(0);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(output).toContain('assets/config/.env.production');
    expect(existsSync(join(workspace, 'docs', 'index.html'))).toBe(false);
  });

  it('refuses artifacts with banned directories at any depth', () => {
    const workspace = makeWorkspace({
      'index.html': '<!doctype html><title>site</title>',
      'assets/embedded/tsconfig.json': '{}',
    });

    const result = runPublishScript(workspace);

    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status, output).not.toBe(0);
    expect(output).toContain('assets/embedded/tsconfig.json');
    expect(existsSync(join(workspace, 'docs', 'index.html'))).toBe(false);
  });

  it('publishes an artifact made of legitimate static files', () => {
    const workspace = makeWorkspace({
      'index.html': '<!doctype html><title>site</title>',
      'assets/app.css': ':root {}',
      'nested/dir/logo.svg': '<svg></svg>',
    });

    const result = runPublishScript(workspace);

    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status, output).toBe(0);
    expect(existsSync(join(workspace, 'docs', 'index.html'))).toBe(true);
    expect(existsSync(join(workspace, 'docs', '.nojekyll'))).toBe(true);
    expect(readFileSync(join(workspace, 'docs', 'assets', 'app.css'), 'utf8')).toBe(':root {}');
    expect(readFileSync(join(workspace, 'docs', 'nested', 'dir', 'logo.svg'), 'utf8')).toBe(
      '<svg></svg>',
    );
  });
});
