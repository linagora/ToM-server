#!/usr/bin/env node

/**
 * Copy templates folder to dist directory for packages
 * Usage: node scripts/copy-templates.cjs <package-name>
 */

const fs = require('fs');
const path = require('path');

const packageName = process.argv[2];

if (!packageName) {
  console.error('Error: Package name is required');
  console.error('Usage: node scripts/copy-templates.cjs <package-name>');
  process.exit(1);
}

const packageDir = path.join(__dirname, '..', 'packages', packageName);
const templatesDir = path.join(packageDir, 'templates');
const distTemplatesDir = path.join(packageDir, 'dist', 'templates');

// Check if templates directory exists
if (!fs.existsSync(templatesDir)) {
  console.log(`No templates directory found for ${packageName}, skipping...`);
  process.exit(0);
}

// Create dist/templates directory if it doesn't exist
if (!fs.existsSync(distTemplatesDir)) {
  fs.mkdirSync(distTemplatesDir, { recursive: true });
}

// Recursively copy directory
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied ${path.relative(packageDir, srcPath)} to ${path.relative(packageDir, destPath)}`);
    }
  }
}

copyDir(templatesDir, distTemplatesDir);
console.log(`✓ Templates copied for ${packageName}`);
