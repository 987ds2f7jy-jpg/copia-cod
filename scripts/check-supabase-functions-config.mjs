import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const functionsDir = join(root, 'supabase', 'functions');
const configPath = join(root, 'supabase', 'config.toml');

const deployableFunctions = readdirSync(functionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .filter((entry) => (
    existsSync(join(functionsDir, entry.name, 'index.ts')) ||
    existsSync(join(functionsDir, entry.name, 'index.js'))
  ))
  .map((entry) => entry.name)
  .sort();

const configText = readFileSync(configPath, 'utf8');
const configuredFunctions = Array.from(
  configText.matchAll(/^\[functions\.([^\]]+)\]\s*$/gm),
  (match) => match[1],
).sort();

const configuredSet = new Set(configuredFunctions);
const deployableSet = new Set(deployableFunctions);
const missing = deployableFunctions.filter((name) => !configuredSet.has(name));
const orphaned = configuredFunctions.filter((name) => !deployableSet.has(name));

if (missing.length > 0 || orphaned.length > 0) {
  if (missing.length > 0) {
    console.error(`Missing function config blocks: ${missing.join(', ')}`);
  }
  if (orphaned.length > 0) {
    console.error(`Config blocks without deployable function: ${orphaned.join(', ')}`);
  }
  process.exit(1);
}

console.log(`Supabase function config synchronized (${deployableFunctions.length} functions).`);
