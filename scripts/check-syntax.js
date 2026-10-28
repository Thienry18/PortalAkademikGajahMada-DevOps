'use strict';
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { Script } = require('node:vm');

function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', '.git', 'artifacts'].includes(entry.name)) continue;
    const file = join(directory, entry.name);
    if (entry.isDirectory()) check(file);
    else if (file.endsWith('.js')) {
      if (spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' }).status !== 0) process.exit(1);
    } else if (file.endsWith('.html')) {
      for (const [, attributes, source] of readFileSync(file, 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (!/\bsrc\s*=|\btype\s*=/.test(attributes)) new Script(source, { filename: file });
      }
    }
  }
}
check('.');
console.log('JavaScript and inline frontend script syntax passed.');
