#!/usr/bin/env node
/**
 * Cross-platform script to clean build artifacts
 * Replaces: rimraf dist coverage
 *
 * Usage: node scripts/clean.cjs <dir1> <dir2> ...
 * Example: node scripts/clean.cjs dist coverage
 */
const { rm } = require('fs/promises');
const { glob } = require('glob');

async function clean() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node scripts/clean.cjs <dir1> <dir2> ...');
    process.exit(1);
  }

  const cwd = process.cwd();

  for (const dir of args) {
    // Expand glob patterns
    const matches = await glob(dir, { cwd, absolute: true, dot: true });

    if (matches.length === 0) {
      console.log(`⊘ ${dir} (no matches found)`);
      continue;
    }

    for (const fullPath of matches) {
      try {
        await rm(fullPath, { recursive: true, force: true });
        console.log(`✓ Removed ${fullPath}`);
      } catch (err) {
        console.error(`✗ Failed to remove ${fullPath}:`, err.message);
        process.exit(1);
      }
    }
  }

  console.log('Clean complete');
}

clean().catch((err) => {
  console.error('Clean failed:', err);
  process.exit(1);
});
