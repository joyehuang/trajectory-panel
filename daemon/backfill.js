#!/usr/bin/env node
// One-shot backfill: reads the most recent N session .jsonl files, redacts,
// and upserts them into Turso — so the site has history immediately instead
// of waiting for live activity to populate the DB.
//
// Usage:
//   node daemon/backfill.js [--dir <path>] [--count 20]

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { SessionState } = require('./lib/session');
const { redactRawLine } = require('./lib/redact');
const { TursoSync } = require('./lib/db');

function parseArgs(argv) {
  const args = { count: 20 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') args.dir = argv[++i];
    else if (a === '--count') args.count = Number(argv[++i]);
  }
  return args;
}

function log(...parts) {
  console.log(`[${new Date().toISOString()}]`, ...parts);
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const dir = cli.dir || process.env.SESSIONS_DIR || path.join(os.homedir(), '.pi', 'agent', 'sessions');

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => {
      const full = path.join(dir, f);
      return { fileName: f, filePath: full, mtimeMs: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, cli.count);

  log(`backfilling ${files.length} session(s) from ${dir}`);

  const db = new TursoSync();
  await db.init();

  for (const f of files) {
    const state = new SessionState(f.fileName);
    const text = fs.readFileSync(f.filePath, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue;
      }
      state.ingestParsed(redactRawLine(parsed));
    }
    await db.syncTracker({ state });
    log(`  ${f.fileName}: ${state.events.length} events`);
  }

  db.close();
  log('backfill complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
