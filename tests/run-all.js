#!/usr/bin/env node
/**
 * Stage·Assign regression runner.
 * Runs every *.js test in this folder (except this file) against ../index.html
 * and prints a one-line pass/fail per test plus a summary.
 *
 *   node tests/run-all.js
 *   SA_HTML=/path/to/some.html node tests/run-all.js   # test a different build
 *
 * Each test prints a line like "=== RESULT: ALL CHECKS PASSED ===" or
 * "=== RESULT: N ISSUE(S) ===". We parse that.
 *
 * KNOWN FALSE-FAILS (not real bugs — see CLAUDE.md):
 *   - curve.js  → 1 issue: the onSave stub never writes localStorage in the harness.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const KNOWN_FALSE_FAILS = { 'curve.js': 1 };

const dir = __dirname;
const files = fs.readdirSync(dir)
  .filter(f => f.endsWith('.js') && f !== 'run-all.js')
  .sort();

let realFailures = 0;
let knownFailures = 0;
const rows = [];

for (const f of files) {
  let out = '';
  try {
    out = execFileSync('node', [path.join(dir, f)], { encoding: 'utf8', timeout: 60000 });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
  }
  const m = out.match(/=== RESULT:\s*(.+?)\s*===/);
  const result = m ? m[1] : 'NO RESULT LINE';
  const issuesMatch = result.match(/(\d+)\s+ISSUE/);
  const issues = result.includes('ALL CHECKS PASSED') ? 0 : (issuesMatch ? parseInt(issuesMatch[1], 10) : -1);

  let status;
  if (issues === 0) {
    status = 'PASS';
  } else if (KNOWN_FALSE_FAILS[f] != null && issues === KNOWN_FALSE_FAILS[f]) {
    status = 'PASS*'; knownFailures++;
  } else {
    status = 'FAIL'; realFailures++;
  }
  rows.push({ f, status, result });
}

console.log('\nStage·Assign regression suite\n' + '='.repeat(60));
for (const r of rows) {
  console.log(`  ${r.status.padEnd(6)} ${r.f.padEnd(20)} ${r.result}`);
}
console.log('='.repeat(60));
console.log(`  ${rows.length} files | ${realFailures} real failure(s) | ${knownFailures} known false-fail(s) [*]`);
if (realFailures === 0) {
  console.log('  ✅ SUITE GREEN (allowing known false-fails)\n');
  process.exit(0);
} else {
  console.log('  ❌ REAL REGRESSION(S) — investigate before shipping\n');
  process.exit(1);
}
