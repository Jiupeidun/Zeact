import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'zeact-package-'));

function run(command, args, cwd) {
  const environment = {
    ...process.env,
    npm_config_audit: 'false',
    npm_config_fund: 'false',
  };
  delete environment.npm_config_dry_run;
  delete environment.NPM_CONFIG_DRY_RUN;

  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: environment,
  });

  if (result.status !== 0) {
    throw new Error([
      `${command} ${args.join(' ')} failed with exit code ${result.status}.`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n'));
  }

  return result.stdout;
}

try {
  const packOutput = run('npm', [
    'pack',
    '--json',
    '--ignore-scripts',
    '--pack-destination',
    temporaryDirectory,
  ], process.cwd());
  const [packResult] = JSON.parse(packOutput);
  assert(packResult, 'npm pack did not return package metadata.');

  const includedFiles = new Set(packResult.files.map(({ path }) => path));
  const requiredFiles = [
    'LICENSE',
    'README.md',
    'package.json',
    'dist/index.js',
    'dist/index.cjs',
    'dist/index.d.ts',
    'dist/hooks/index.js',
    'dist/chat/index.js',
    'dist/trade/index.js',
    'dist/live/index.js',
  ];

  for (const file of requiredFiles) {
    assert(includedFiles.has(file), `Published package is missing ${file}.`);
  }

  assert(packResult.size < 150_000, `Package archive grew to ${packResult.size} bytes.`);

  await writeFile(join(temporaryDirectory, 'package.json'), JSON.stringify({ private: true }));
  const tarball = join(temporaryDirectory, packResult.filename);
  run('npm', ['install', '--ignore-scripts', tarball, 'react@18.3.1', 'react-dom@18.3.1'], temporaryDirectory);

  await writeFile(join(temporaryDirectory, 'smoke.mjs'), `
    import * as root from '@kertin/zeact';
    import * as hooks from '@kertin/zeact/hooks';
    import * as chat from '@kertin/zeact/chat';
    import * as trade from '@kertin/zeact/trade';
    import * as live from '@kertin/zeact/live';

    const exportsToCheck = [
      root.createKeyedStore,
      hooks.useRafState,
      chat.VirtualChatList,
      trade.createQuoteStore,
      live.useMediaState,
    ];
    if (exportsToCheck.some((value) => typeof value !== 'function')) process.exit(1);
  `);
  run('node', ['smoke.mjs'], temporaryDirectory);

  await writeFile(join(temporaryDirectory, 'smoke.cjs'), `
    const root = require('@kertin/zeact');
    const chat = require('@kertin/zeact/chat');
    const trade = require('@kertin/zeact/trade');
    const live = require('@kertin/zeact/live');
    if ([root.createKeyedStore, chat.VirtualChatList, trade.createQuoteStore, live.useMediaState]
      .some((value) => typeof value !== 'function')) process.exit(1);
  `);
  run('node', ['smoke.cjs'], temporaryDirectory);

  const manifest = JSON.parse(await readFile(join(temporaryDirectory, 'node_modules/@kertin/zeact/package.json'), 'utf8'));
  assert.equal(manifest.private, undefined, 'Published manifest must not be private.');
  assert.equal(manifest.publishConfig?.access, 'public', 'Package must publish with public access.');

  process.stdout.write(`Validated ${packResult.name}@${packResult.version}: ${packResult.entryCount} files, ${packResult.size} bytes.\n`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
