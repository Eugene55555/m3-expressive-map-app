import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const distDir = join(root, 'dist');
const docsDir = join(root, 'docs');

if (!existsSync(distDir)) {
  console.error('publish-docs: dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

if (readdirSync(distDir).length === 0) {
  console.error('publish-docs: dist/ is empty.');
  process.exit(1);
}

// Safety net: every path component — at any depth — must be a plain static
// site component. Banned directories and sensitive filenames (including
// `.env` and `.env.*`) are rejected wherever they appear in the artifact.
const bannedComponents = new Set([
  'node_modules',
  'src',
  'tests',
  'scripts',
  'tsconfig.json',
  'vite.config.ts',
]);

function isSensitiveComponent(segment) {
  return bannedComponents.has(segment) || segment === '.env' || segment.startsWith('.env.');
}

const offenders = [];
function scan(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = resolve(full).slice(resolve(distDir).length + 1);
    const segments = rel.split(/[\\/]/);
    if (segments.some(isSensitiveComponent)) {
      offenders.push(rel);
      continue;
    }
    if (statSync(full).isDirectory()) {
      scan(full);
    }
  }
}
scan(distDir);

if (offenders.length > 0) {
  console.error(`publish-docs: refusing artifact, unwanted files present:\n  ${offenders.join('\n  ')}`);
  process.exit(1);
}

rmSync(docsDir, { recursive: true, force: true });
mkdirSync(docsDir, { recursive: true });
cpSync(distDir, docsDir, { recursive: true });

writeFileSync(join(docsDir, '.nojekyll'), '');

if (existsSync(join(docsDir, 'index.html'))) {
  console.log('publish-docs: copied dist/ to docs/ and wrote docs/.nojekyll');
} else {
  console.error('publish-docs: docs/index.html is missing after copy.');
  process.exit(1);
}
