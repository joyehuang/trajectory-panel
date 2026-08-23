# trajectory-panel daemon

A small local, persistent Node process that watches your live `pi` agent
session files, redacts anything secret-shaped, and makes the data available
to the frontend two ways:

1. **WebSocket** (`ws://localhost:8787`) — true realtime, for when the
   frontend is running on the same Mac (or same LAN).
2. **Turso (libSQL)** (default on) — the daemon upserts redacted
   sessions/events into a Turso DB. The Vercel deploy's `api/` serverless
   functions read from the same DB, so the site updates within seconds of
   any pi activity, from anywhere.
3. **Cloudflare R2** (legacy, opt-in via `--sync-r2`) — the daemon can also
   upload redacted session files + an index to a public R2 bucket. Kept
   working for anyone who still wants it, independent of DB sync.

```
pi agent → ~/.pi/agent/sessions/<project>/*.jsonl
              │  fs.watch + periodic re-scan
              ▼
       daemon/server.js
       ├─ incremental parse + redact (daemon/lib/session.js, daemon/lib/redact.js)
       ├─ WebSocket broadcast          ───────────► frontend (useLiveSessions, WS mode)
       ├─ Turso upsert (daemon/lib/db.js) ─────────► api/*.js (Vercel) ─► frontend polls (poll mode)
       └─ [--sync-r2, legacy] rclone copyto ───────► R2 bucket
```

## Running it

```bash
cd daemon
npm install          # once — installs @libsql/client + ws
node server.js        # local WS + Turso sync (DB sync is on by default)
node server.js --no-sync-db   # WS only, no DB writes
node server.js --sync-r2      # also publish redacted sessions to R2 (legacy)
```

Run from anywhere — paths are resolved relative to the daemon's own
directory / your home directory, not the cwd. `npm start` inside `daemon/`
does the same as `node server.js`.

DB sync reads Turso credentials from `~/.config/turso/env`
(`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`, dotenv-style) — never hardcoded,
never logged. The same two vars need to be set as Vercel project env vars
for the API routes to work (`vercel env add TURSO_DATABASE_URL` /
`TURSO_AUTH_TOKEN`, once per environment).

To backfill existing sessions into a fresh DB (so the site has history
immediately instead of waiting for live activity):

```bash
node daemon/backfill.js --count 20
```

### Flags / env vars

| Flag              | Env var        | Default                                          | Meaning                                        |
| ------------------ | -------------- | ------------------------------------------------- | ----------------------------------------------- |
| `--dir <path>`      | —              | `~/.pi/agent/sessions/<project>`             | Directory of `.jsonl` session files to watch     |
| `--port <n>`        | `PORT`         | `8787`                                             | WebSocket listen port                            |
| `--host <addr>`     | `HOST`         | `0.0.0.0`                                          | WebSocket bind address (0.0.0.0 = also reachable over LAN) |
| `--max-sessions <n>`| `MAX_SESSIONS` | `20`                                               | Only the N most-recently-modified sessions are tracked/synced |
| `--no-sync-db`      | `SYNC_DB=0`    | off (DB sync on by default)                        | Disable upserting sessions/events into Turso     |
| `--out-dir <path>`  | —              | `daemon/out/`                                      | Local staging dir for redacted files + `index.json` (only used by `--sync-r2`) |
| `--sync-r2`         | `SYNC_R2=1`    | off                                                | Legacy: upload redacted sessions + index to R2 (see below) |

### Stopping it

`Ctrl+C` (SIGINT) or SIGTERM — both trigger a graceful shutdown.

## Why `--sync-r2` is opt-in, not automatic

Enabling it publishes redacted (but still real) conversation content to a
**public** R2 URL (`R2_PUBLIC_BASE` from `~/.config/r2-upload/env`, currently
`pub-5d453927f5eb462dad58b9ac1b2fbacd.r2.dev`). That's a one-way door worth a
conscious decision each time you want it live, rather than something that
turns on by default the moment the daemon starts. The redaction pipeline is
covered by tests (see "Redaction" below) and was verified end-to-end against
a real R2 upload + fetch during development, but you're still choosing to
publish your own conversation history — flip it on when you want that.
Turso sync is on by default instead, since the DB isn't publicly readable —
only the Vercel deploy's server-side `api/` functions hold the credentials.

## launchd (run it persistently in the background)

Create `~/Library/LaunchAgents/com.example.trajectory-panel-daemon.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.example.trajectory-panel-daemon</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/path/to/trajectory-panel/daemon/server.js</string>
    <!-- add <string>--sync-r2</string> here once you want R2 sync always-on -->
  </array>
  <key>WorkingDirectory</key>
  <string>/path/to/trajectory-panel/daemon</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/trajectory-panel-daemon.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/trajectory-panel-daemon.log</string>
</dict>
</plist>
```

Check `which node` first and fix the `node` path above if it's not
`/usr/local/bin/node` (Homebrew on Apple Silicon is usually
`/opt/homebrew/bin/node`). Then:

```bash
launchctl load ~/Library/LaunchAgents/com.example.trajectory-panel-daemon.plist
# ...
launchctl unload ~/Library/LaunchAgents/com.example.trajectory-panel-daemon.plist  # to stop
```

This plist is a template, not installed automatically — load it yourself
when you're ready to have the daemon start on every login.

## Wire protocol (WebSocket)

Every message is JSON, one object per `ws.send()`. A `session` object always
has the same shape everywhere it appears (`hello`, `session-new`, `update`):

```ts
{ id: string, fileName: string, meta: SessionMeta, events: TimelineEvent[] }
```

`SessionMeta` and `TimelineEvent` are exactly the shapes in `src/types.ts` —
the daemon's `daemon/lib/session.js` is a hand-kept incremental mirror of
`src/parse.ts`, so no adapter is needed on the frontend.

- **`hello`** — sent once, right after connect: `{ type: 'hello', sessions: Session[] }`,
  a full snapshot of every currently-tracked session (up to `--max-sessions`),
  each with its complete `events` array so far.
- **`session-new`** — a `.jsonl` file appeared that wasn't tracked yet:
  `{ type: 'session-new', session: Session }` (full session, same as above).
- **`update`** — new lines were tailed from an already-tracked file:
  `{ type: 'update', session: { id, fileName, meta, events } }` where
  `events` holds only what changed this tick — newly-appended events *and*
  any existing event that got mutated in place (the most common case: a
  `tool_call` event whose `result`/`status`/`resultTimestamp` just arrived).
  The frontend should upsert by event `id`, not blindly append.

## Redaction

`daemon/lib/redact.js` ports the regexes from `scripts/generate-samples.py`
1:1 (Telegram bot tokens, `sk-`/`ghp_`/`AKIA`/`xox*`/`Bearer `/`cfat_`/`r2_`/`vca_`
key shapes, and secret-named fields). Every raw JSONL line is redacted
*before* it's parsed into events or written anywhere — both the WebSocket
feed and the R2-published copy pass through the same `redactRawLine()`.

Two differences from the sample-generator script, both deliberate:

- **Usage/cost data** is kept for the local WebSocket feed (so the live
  token meter / stats strip work), and only stripped for the copy that goes
  to R2 (`stripUsageForPublish()`) — matching how the bundled samples never
  carry usage either.
- **No truncation-driven event cap** — `generate-samples.py`'s `MAX_EVENTS`
  is a curation limit for hand-picked demo files; the daemon keeps every
  event for the sessions it tracks (bounded instead by `--max-sessions`).

To sanity-check the redaction rules yourself:

```bash
node -e "
const { redactText, containsSecret } = require('./daemon/lib/redact.js');
const fake = '123456789:AAfakeToken1234567890abcdefghijkl';
console.log(containsSecret(fake), '->', containsSecret(redactText(fake)));
// true -> false
"
```

## Turso schema

Two tables, created automatically (`CREATE TABLE IF NOT EXISTS`) on daemon
startup and by `backfill.js`:

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,            -- pi session id
  file_name TEXT NOT NULL UNIQUE, -- source jsonl filename
  timestamp TEXT, cwd TEXT, provider TEXT, model_id TEXT, thinking_level TEXT,
  turn_count INTEGER DEFAULT 0, tool_call_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0, cost_total REAL DEFAULT 0,
  last_seen_at TEXT               -- drives "most recent activity" ordering
);

CREATE TABLE events (
  id TEXT NOT NULL, session_id TEXT NOT NULL REFERENCES sessions(id),
  parent_id TEXT, timestamp TEXT, kind TEXT NOT NULL,
  payload TEXT NOT NULL,          -- JSON, exactly one TimelineEvent from src/types.ts
  seq INTEGER,                    -- order within session
  UNIQUE(session_id, id)
);
```

`payload` is the exact `TimelineEvent` object, so `api/sessions/[id].js` just
parses each row's JSON and returns `{ meta, events }` — no translation layer,
same shape `parseSession()` produces. Every write is an upsert keyed on
`(session_id, id)` for events / `file_name` for sessions, so daemon restarts
and re-tailing never duplicate rows — a mutated `tool_call` (result arriving
later) just overwrites its existing row.

## R2 layout

```
r2://<your-bucket>/trajectory-panel/
  index.json                    # [{fileName, sessionId, timestamp, modelId, turnCount, toolCallCount, totalTokens}]
  sessions/<fileName>.jsonl     # redacted raw JSONL, same wire format as public/samples/*.jsonl
```

The daemon shells out to `rclone copyto` using the `r2:` remote that's
already configured on this machine (`rclone config show r2`) — it never
reads `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` itself, only the
non-secret `R2_BUCKET` / `R2_PUBLIC_BASE` from `~/.config/r2-upload/env` (to
know where to write / what URL the frontend should poll).

The frontend's poll fallback (`src/hooks/useLiveSessions.ts`) fetches
`index.json`, diffs it against what it already has, and for anything new
fetches `sessions/<fileName>.jsonl` and runs it through the exact same
`parseSession()` used for bundled samples and file uploads — no separate
parser needed for that path.
