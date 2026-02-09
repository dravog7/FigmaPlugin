import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2018',
  outfile: 'code.js',
  logLevel: 'info'
});
