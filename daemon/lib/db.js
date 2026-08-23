// Turso (libSQL) sync — the primary data path for the Vercel deploy.
//
// Two tables: `sessions` (meta + rollup counters) and `events` (one row per
// TimelineEvent, payload stored as JSON so the API can hand rows back to the
// frontend's existing parseSession-shaped model without a translation layer).
//
// Credentials are read from ~/.config/turso/env (dotenv-style: KEY=VALUE per
// line) — never hardcoded, never logged.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createClient } = require('@libsql/client');

function readEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function loadTursoConfig() {
  const envPath = path.join(os.homedir(), '.config', 'turso', 'env');
  const env = readEnvFile(envPath);
  if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
    throw new Error(`missing TURSO_DATABASE_URL/TURSO_AUTH_TOKEN in ${envPath}`);
  }
  return { url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN };
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    timestamp TEXT,
    cwd TEXT,
    provider TEXT,
    model_id TEXT,
    thinking_level TEXT,
    turn_count INTEGER DEFAULT 0,
    tool_call_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_total REAL DEFAULT 0,
    last_seen_at TEXT,
    UNIQUE(file_name)
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT NOT NULL,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    parent_id TEXT,
    timestamp TEXT,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    seq INTEGER,
    UNIQUE(session_id, id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_events_session_seq ON events(session_id, seq)`,
  `CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen_at)`,
];

/** Thin wrapper around @libsql/client: schema bootstrap + upsert helpers. */
class TursoSync {
  constructor() {
    const cfg = loadTursoConfig();
    this.client = createClient({ url: cfg.url, authToken: cfg.authToken });
  }

  async init() {
    // Turso manages journal mode server-side over the Hrana protocol —
    // PRAGMA journal_mode is rejected as an unsupported statement here.
    for (const stmt of SCHEMA) {
      await this.client.execute(stmt);
    }
  }

  /** Upserts a session + all its events in one batched transaction (per-tracker, per-tick). */
  async syncTracker(tracker) {
    const meta = tracker.state.meta;
    const events = tracker.state.events;
    const statements = [
      {
        sql: `INSERT INTO sessions
                (id, file_name, timestamp, cwd, provider, model_id, thinking_level,
                 turn_count, tool_call_count, total_tokens, cost_total, last_seen_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(file_name) DO UPDATE SET
                id = excluded.id,
                timestamp = excluded.timestamp,
                cwd = excluded.cwd,
                provider = excluded.provider,
                model_id = excluded.model_id,
                thinking_level = excluded.thinking_level,
                turn_count = excluded.turn_count,
                tool_call_count = excluded.tool_call_count,
                total_tokens = excluded.total_tokens,
                cost_total = excluded.cost_total,
                last_seen_at = datetime('now')`,
        args: [
          meta.id,
          meta.fileName,
          meta.timestamp,
          meta.cwd,
          meta.provider,
          meta.modelId,
          meta.thinkingLevel,
          meta.turnCount,
          meta.toolCallCount,
          meta.usageTotal?.totalTokens ?? 0,
          meta.usageTotal?.costTotal ?? 0,
        ],
      },
      ...events.map((event, seq) => ({
        sql: `INSERT INTO events (id, session_id, parent_id, timestamp, kind, payload, seq)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(session_id, id) DO UPDATE SET
                payload = excluded.payload,
                parent_id = excluded.parent_id,
                timestamp = excluded.timestamp`,
        args: [event.id, meta.id, event.parentId ?? null, event.timestamp ?? null, event.kind, JSON.stringify(event), seq],
      })),
    ];
    await this.client.batch(statements, 'write');
  }

  close() {
    this.client.close();
  }
}

module.exports = { TursoSync, loadTursoConfig };
