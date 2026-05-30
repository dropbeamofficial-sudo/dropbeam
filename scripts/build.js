#!/usr/bin/env node
/**
 * DropBeam — build.js
 * Build script for Vercel deployment.
 * Reads existing config from _env.js, then copies only frontend
 * files to dist/ for a clean static deployment.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Files to include in the static deployment
const FILES_TO_COPY = [
  'index.html',
  'admin.html',
  'style.css',
  'script.js',
  'favicon.svg',
  'Shriiis_logo.png',
];

// Default Supabase config (used when _env.js doesn't exist)
const DEFAULTS = {
  SUPABASE_URL: 'https://tbngouvplswvziszlnee.supabase.co',
  FUNCTIONS_BASE: 'https://tbngouvplswvziszlnee.supabase.co/functions/v1',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibmdvdXZwbHN3dnppc3psbmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMzYyMTAsImV4cCI6MjA5NTcxMjIxMH0.IYtJnPMWKLdrhIr3f5JTY819cQOguyKw75JzUvKlhRM'
};

// Read existing _env.js at project root for current config values
function readExistingConfig() {
  const envPath = path.join(ROOT, '_env.js');
  if (!fs.existsSync(envPath)) return null;
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    const url = content.match(/__SUPABASE_URL__\s*=\s*['"]([^'"]+)['"]/);
    const base = content.match(/__FUNCTIONS_BASE__\s*=\s*['"]([^'"]+)['"]/);
    const key = content.match(/__SUPABASE_ANON_KEY__\s*=\s*['"]([^'"]+)['"]/);
    return {
      SUPABASE_URL: url ? url[1] : null,
      FUNCTIONS_BASE: base ? base[1] : null,
      SUPABASE_ANON_KEY: key ? key[1] : null,
    };
  } catch (e) {
    console.warn('  Warning: could not parse _env.js, using defaults');
    return null;
  }
}

console.log('Building DropBeam frontend for deployment...\n');

// Create dist directory
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true });
  console.log('  Cleaned existing dist/');
}
fs.mkdirSync(DIST, { recursive: true });

// Copy frontend files
let copied = 0;
for (const file of FILES_TO_COPY) {
  const src = path.join(ROOT, file);
  const dest = path.join(DIST, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    copied++;
    console.log('  Copied: ' + file);
  } else {
    console.warn('  Warning: ' + file + ' not found, skipping');
  }
}

// Read existing config
const existing = readExistingConfig();
const config = existing || DEFAULTS;
if (existing) {
  console.log('  Read config from existing _env.js');
} else {
  console.log('  Using default config (no _env.js found)');
}

// Allow environment variables to override
const supabaseUrl = process.env.SUPABASE_URL || config.SUPABASE_URL;
const functionsBase = process.env.FUNCTIONS_BASE || config.FUNCTIONS_BASE;
const anonKey = process.env.SUPABASE_ANON_KEY || config.SUPABASE_ANON_KEY;

// Generate _env.js in dist/
const envContent = '// DropBeam - Supabase configuration (auto-generated at build time)\n' +
  'window.__SUPABASE_URL__ = \'' + supabaseUrl + '\';\n' +
  'window.__FUNCTIONS_BASE__ = \'' + functionsBase + '\';\n' +
  'window.__SUPABASE_ANON_KEY__ = \'' + anonKey + '\';\n';

fs.writeFileSync(path.join(DIST, '_env.js'), envContent);
console.log('  Generated: _env.js');

console.log('\nBuild complete! dist/ contains ' + (copied + 1) + ' files');
