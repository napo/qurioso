import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('build/desktop', { recursive: true });
await build({
  entryPoints: ['server.ts'],
  outfile: 'build/desktop/server.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  external: ['vite', 'bufferutil', 'utf-8-validate'],
});
