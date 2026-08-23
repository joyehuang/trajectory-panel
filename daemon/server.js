#!/usr/bin/env node
// Local realtime daemon for trajectory-panel.
//
//   pi agent -> writes ~/.pi/agent/sessions/<project>/*.jsonl
//   this daemon -> tails new lines, redacts, keeps an in-memory session map,
//                  broadcasts deltas over WebSocket (same-machine realtime),
//                  and upserts redacted sessions/events into Turso (libSQL)
//                  so the Vercel deploy can poll them from anywhere.
//
// Usage:
//   node daemon/server.js [--dir <path>] [--port 8787] [--host 0.0.0.0]
//                          [--max-sessions 20] [--no-sync-db] [--sync-r2]
//                          [--out-dir <path>]
//
// DB sync reads Turso credentials from ~/.config/turso/env and is on by
// default; pass --no-sync-db to disable. --sync-r2 is legacy/opt-in (rclone
// to Cloudflare R2) and is independent of DB sync.
//
// See daemon/README.md for the wire protocol and DB schema.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { WebSocketServer } = require('ws');

const { SessionState } = require('./lib/session');
const { redactRawLine, stripUsageForPublish } = require('./lib/redact');
const { loadR2PublicConfig, rcloneCopyTo } = require('./lib/r2');
const { TursoSync } = require('./lib/db');

// --- CLI args -------------------------------------------------------------

function parseArgs(argv) {
  const args = { syncR2: false, syncDb: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') args.dir = argv[++i];
    else if (a === '--port') args.port = Number(argv[++i]);
    else if (a === '--host') args.host = argv[++i];
    else if (a === '--max-sessions') args.maxSessions = Number(argv[++i]);
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--sync-r2') args.syncR2 = true;
    else if (a === '--sync-db') args.syncDb = true;
    else if (a === '--no-sync-db') args.syncDb = false;
  }
  return args;
}

const cli = parseArgs(process.argv.slice(2));

const WATCH_DIR = cli.dir || process.env.SESSIONS_DIR || path.join(os.homedir(), '.pi', 'agent', 'sessions');
const PORT = cli.port || Number(process.env.PORT) || 8787;
const HOST = cli.host || process.env.HOST || '0.0.0.0';
const MAX_SESSIONS = cli.maxSessions || Number(process.env.MAX_SESSIONS) || 20;
const OUT_DIR = cli.outDir || path.join(__dirname, 'out');
const OUT_SESSIONS_DIR = path.join(OUT_DIR, 'sessions');
const SYNC_R2 = cli.syncR2 || process.env.SYNC_R2 === '1';
const SYNC_DB = cli.syncDb && process.env.SYNC_DB !== '0';
const RESCAN_INTERVAL_MS = 5000;
const R2_SYNC_DEBOUNCE_MS = 1500;
const DB_SYNC_DEBOUNCE_MS = 1000;

function log(...parts) {
  console.log(`[${new Date().toISOString()}]`, ...parts);
}

// --- per-file tracking ------------------------------------------------------
//
// Each tracked session keeps: the incremental TimelineEvent parser (state),
// the raw redacted lines seen so far (rawRedactedLines — written straight to
// disk/R2, same wire format as public/samples/*.jsonl), and tailing offsets.

class Tracker {
  constructor(fileName, filePath) {
    this.fileName = fileName;
    this.filePath = filePath;
    this.state = new SessionState(fileName);
    this.rawRedactedLines = [];
    this.byteOffset = 0;
    this.lineBuffer = '';
  }
}

/** The one session shape sent over the wire — used identically by hello, session-new, and update. */
function toWireSession(tracker, events = tracker.state.events) {
  return { id: tracker.state.meta.id, fileName: tracker.fileName, meta: tracker.state.meta, events };
}

/** fileName -> Tracker, ordered by insertion; capped at MAX_SESSIONS via evictOldest(). */
const trackers = new Map();

function listJsonlFilesByMtimeDesc(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (err) {
    log(`ERROR reading ${dir}:`, err.message);
    return [];
  }
  return entries
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => {
      const full = path.join(dir, f);
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(full).mtimeMs;
      } catch {
        /* file disappeared mid-scan */
      }
      return { fileName: f, filePath: full, mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/** Reads new bytes since tracker.byteOffset, ingests complete lines, returns emitted events. */
function tailFile(tracker) {
  let stat;
  try {
    stat = fs.statSync(tracker.filePath);
  } catch {
    return [];
  }
  if (stat.size <= tracker.byteOffset) return [];

  const fd = fs.openSync(tracker.filePath, 'r');
  const len = stat.size - tracker.byteOffset;
  const buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, tracker.byteOffset);
  fs.closeSync(fd);
  tracker.byteOffset = stat.size;

  const chunk = tracker.lineBuffer + buf.toString('utf8');
  const lines = chunk.split('\n');
  tracker.lineBuffer = lines.pop() ?? '';

  const emitted = [];
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const redacted = redactRawLine(parsed);
    tracker.rawRedactedLines.push(redacted);
    emitted.push(...tracker.state.ingestParsed(redacted));
  }
  return emitted;
}

function evictOldestIfNeeded() {
  while (trackers.size > MAX_SESSIONS) {
    const oldestKey = trackers.keys().next().value;
    trackers.delete(oldestKey);
    log(`evicted ${oldestKey} (over --max-sessions ${MAX_SESSIONS})`);
  }
}

// --- WebSocket broadcast -----------------------------------------------------

const wss = new WebSocketServer({ port: PORT, host: HOST });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  log(`client connected (${clients.size} total)`);
  const sessions = Array.from(trackers.values())
    .sort((a, b) => (b.state.meta.timestamp || '').localeCompare(a.state.meta.timestamp || ''))
    .map((t) => toWireSession(t));
  send(ws, { type: 'hello', sessions });
  ws.on('close', () => {
    clients.delete(ws);
    log(`client disconnected (${clients.size} total)`);
  });
  ws.on('error', () => clients.delete(ws));
});

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function broadcast(payload) {
  const text = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(text);
  }
}

// --- R2 sync (opt-in) --------------------------------------------------------

const r2Config = SYNC_R2 ? loadR2PublicConfig() : null;
let r2SyncTimer = null;
let r2SyncPending = new Set();

function scheduleR2Sync(fileName) {
  if (!SYNC_R2) return;
  r2SyncPending.add(fileName);
  if (r2SyncTimer) return;
  r2SyncTimer = setTimeout(runR2Sync, R2_SYNC_DEBOUNCE_MS);
}

async function runR2Sync() {
  r2SyncTimer = null;
  const pending = Array.from(r2SyncPending);
  r2SyncPending = new Set();

  for (const fileName of pending) {
    const tracker = trackers.get(fileName);
    if (!tracker) continue;
    try {
      writeRedactedFile(tracker);
      await rcloneCopyTo(path.join(OUT_SESSIONS_DIR, fileName), `trajectory-panel/sessions/${fileName}`, r2Config.bucket);
      log(`R2 sync ok: ${fileName}`);
    } catch (err) {
      log(`R2 sync FAILED for ${fileName}:`, err.message);
    }
  }

  try {
    writeIndexFile();
    const indexPath = path.join(OUT_DIR, 'index.json');
    await rcloneCopyTo(indexPath, 'trajectory-panel/index.json', r2Config.bucket);
    log('R2 sync ok: index.json');
  } catch (err) {
    log('R2 sync FAILED for index.json:', err.message);
  }
}

// --- Turso DB sync (default on — the primary data path for the Vercel deploy) ---

let dbSync = null;
let dbReadyPromise = null;
let dbSyncTimer = null;
let dbSyncPending = new Set();

function scheduleDbSync(fileName) {
  if (!SYNC_DB) return;
  dbSyncPending.add(fileName);
  if (dbSyncTimer) return;
  dbSyncTimer = setTimeout(runDbSync, DB_SYNC_DEBOUNCE_MS);
}

async function runDbSync() {
  dbSyncTimer = null;
  const pending = Array.from(dbSyncPending);
  dbSyncPending = new Set();

  try {
    await dbReadyPromise;
  } catch (err) {
    log('DB sync FAILED (init):', err.message);
    return;
  }

  for (const fileName of pending) {
    const tracker = trackers.get(fileName);
    if (!tracker) continue;
    try {
      await dbSync.syncTracker(tracker);
      log(`DB sync ok: ${fileName} (${tracker.state.events.length} events)`);
    } catch (err) {
      log(`DB sync FAILED for ${fileName}:`, err.message);
    }
  }
}

// --- local staging output (always written; R2 upload is the opt-in part) ---

function ensureOutDirs() {
  fs.mkdirSync(OUT_SESSIONS_DIR, { recursive: true });
}

function writeRedactedFile(tracker) {
  const lines = tracker.rawRedactedLines.map((obj) => JSON.stringify(stripUsageForPublish(obj)));
  fs.writeFileSync(path.join(OUT_SESSIONS_DIR, tracker.fileName), lines.join('\n') + (lines.length ? '\n' : ''));
}

function writeIndexFile() {
  const manifest = Array.from(trackers.values())
    .sort((a, b) => (b.state.meta.timestamp || '').localeCompare(a.state.meta.timestamp || ''))
    .map((t) => {
      const m = t.state.meta;
      return {
        fileName: m.fileName,
        sessionId: m.id,
        timestamp: m.timestamp,
        modelId: m.modelId,
        turnCount: m.turnCount,
        toolCallCount: m.toolCallCount,
        totalTokens: m.usageTotal.totalTokens,
      };
    });
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(manifest, null, 2));
}

// --- orchestration: initial load, then watch ---------------------------------

function loadInitial() {
  ensureOutDirs();
  const files = listJsonlFilesByMtimeDesc(WATCH_DIR).slice(0, MAX_SESSIONS);
  for (const f of files) {
    const tracker = new Tracker(f.fileName, f.filePath);
    tailFile(tracker); // reads the whole file since byteOffset starts at 0
    trackers.set(f.fileName, tracker);
    if (SYNC_R2) writeRedactedFile(tracker);
  }
  log(`loaded ${trackers.size} session(s) from ${WATCH_DIR}`);
  if (SYNC_R2) {
    writeIndexFile();
    for (const fileName of trackers.keys()) scheduleR2Sync(fileName);
  }
  if (SYNC_DB) {
    for (const fileName of trackers.keys()) scheduleDbSync(fileName);
  }
}

function handleFileActivity(fileName) {
  if (!fileName.endsWith('.jsonl')) return;
  const filePath = path.join(WATCH_DIR, fileName);
  if (!fs.existsSync(filePath)) return; // deleted/renamed away

  let tracker = trackers.get(fileName);
  const isNewFile = !tracker;
  if (isNewFile) {
    tracker = new Tracker(fileName, filePath);
    trackers.set(fileName, tracker);
    evictOldestIfNeeded();
  }

  const emitted = tailFile(tracker);
  if (emitted.length === 0 && !isNewFile) return;

  if (isNewFile) {
    log(`new session: ${fileName}`);
    broadcast({ type: 'session-new', session: toWireSession(tracker) });
  } else if (emitted.length > 0) {
    broadcast({ type: 'update', session: toWireSession(tracker, emitted) });
  }

  if (emitted.length > 0) {
    scheduleR2Sync(fileName);
    scheduleDbSync(fileName);
  } else if (isNewFile) {
    scheduleDbSync(fileName);
  }
}

// fs.watch on macOS (FSEvents) is generally reliable for a single directory,
// but we also periodically re-scan as a safety net against missed events.
function startWatching() {
  try {
    fs.watch(WATCH_DIR, (_eventType, fileName) => {
      if (fileName) handleFileActivity(fileName);
    });
    log(`watching ${WATCH_DIR}`);
  } catch (err) {
    log(`ERROR: could not watch ${WATCH_DIR}:`, err.message);
  }

  setInterval(() => {
    const files = listJsonlFilesByMtimeDesc(WATCH_DIR).slice(0, MAX_SESSIONS);
    for (const f of files) handleFileActivity(f.fileName);
  }, RESCAN_INTERVAL_MS);
}

// --- boot ---------------------------------------------------------------------

log(`trajectory-panel daemon starting`);
log(`  watch dir     : ${WATCH_DIR}`);
log(`  ws listen     : ws://${HOST}:${PORT}`);
log(`  max sessions  : ${MAX_SESSIONS}`);
log(`  sync to Turso : ${SYNC_DB ? 'yes' : 'no (pass --sync-db to enable, or unset --no-sync-db)'}`);
log(`  sync to R2    : ${SYNC_R2 ? `yes (bucket ${r2Config.bucket})` : 'no (pass --sync-r2 to enable, legacy)'}`);

if (SYNC_DB) {
  dbSync = new TursoSync();
  dbReadyPromise = dbSync.init().then(
    () => log('Turso schema ready'),
    (err) => {
      log('ERROR: Turso init failed:', err.message);
      throw err;
    },
  );
}

loadInitial();
startWatching();

function shutdown(signal) {
  log(`${signal} received, shutting down`);
  wss.close(() => process.exit(0));
  if (dbSync) dbSync.close();
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
