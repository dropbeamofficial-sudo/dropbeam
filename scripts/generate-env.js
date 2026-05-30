#!/usr/bin/env node
/**
 * DropBeam — generate-env.js
 * Generates _env.js with Supabase configuration for the frontend
 */

const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL || 'https://tbngouvplswvziszlnee.supabase.co';
const functionsBase = process.env.FUNCTIONS_BASE || supabaseUrl + '/functions/v1';
const anonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibmdvdXZwbHN3dnppc3psbmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMzYyMTAsImV4cCI6MjA5NTcxMjIxMH0.IYtJnPMWKLdrhIr3f5JTY819cQOguyKw75JzUvKlhRM';

const content = `// DropBeam — Supabase configuration (auto-generated at build time)
window.__SUPABASE_URL__ = '${supabaseUrl}';
window.__FUNCTIONS_BASE__ = '${functionsBase}';
window.__SUPABASE_ANON_KEY__ = '${anonKey}';
`;

fs.writeFileSync(path.join(__dirname, '..', '_env.js'), content);
console.log('Generated _env.js for Supabase deployment');
