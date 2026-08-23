import { useEffect, useRef, useState } from 'react';
import type { Session, SessionMeta, TimelineEvent } from '../types';

export type ConnectionStatus = 'demo' | 'connecting' | 'ws' | 'poll' | 'offline';

/**
 * 实时数据通道（本地 daemon WebSocket + /api/sessions 轮询）默认关闭：
 * 开源 demo 部署没有 Turso 凭据，直接展示内置 mock 会话即可。
 * 想接真实数据时，构建前设置 VITE_LIVE_DATA=1（见 README「可选：实时数据」）。
 */
const LIVE_ENABLED = import.meta.env.VITE_LIVE_DATA === '1';

const WS_PORT = 8787;
const WS_CONNECT_TIMEOUT_MS = 1500;
const WS_RETRY_INTERVAL_MS = 15_000;
const POLL_INTERVAL_MS = 2500;
const API_SESSIONS_URL = '/api/sessions';
const ACTIVE_FADE_MS = 20_000;

interface WireSession {
  id: string;
  fileName: string;
  meta: SessionMeta;
  events: TimelineEvent[];
}

interface ApiIndexEntry {
  fileName: string;
  sessionId: string;
  timestamp: string | null;
  modelId: string | null;
  turnCount: number;
  toolCallCount: number;
  totalTokens: number;
}

function mergeEvents(existing: TimelineEvent[], incoming: TimelineEvent[]): TimelineEvent[] {
  const map = new Map(existing.map((e) => [e.id, e] as const));
  for (const e of incoming) map.set(e.id, e);
  return Array.from(map.values());
}

function wsCandidateUrls(): string[] {
  const urls = [`ws://localhost:${WS_PORT}`];
  const host = window.location.hostname;
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    urls.push(`ws://${host}:${WS_PORT}`);
  }
  return urls;
}

/**
 * Live session feed: WebSocket to the local daemon when reachable (true
 * realtime), falling back to polling the R2-published index (near-realtime,
 * works from anywhere the Vercel deploy is reachable — e.g. a phone).
 */
export function useLiveSessions() {
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map());
  const [status, setStatus] = useState<ConnectionStatus>(LIVE_ENABLED ? 'connecting' : 'demo');
  const [activeFileName, setActiveFileName] = useState<string | null>(null);

  // Refs mirror the render state for use inside timers/callbacks, which would
  // otherwise close over stale values captured when the effect first ran.
  const statusRef = useRef<ConnectionStatus>(LIVE_ENABLED ? 'connecting' : 'demo');
  const activeFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knownIndexRef = useRef<Map<string, ApiIndexEntry>>(new Map());
  const currentSocketRef = useRef<WebSocket | null>(null);

  const setStatusBoth = (s: ConnectionStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  const markActive = (fileName: string) => {
    setActiveFileName(fileName);
    if (activeFadeTimer.current) clearTimeout(activeFadeTimer.current);
    activeFadeTimer.current = setTimeout(() => setActiveFileName(null), ACTIVE_FADE_MS);
  };

  useEffect(() => {
    if (!LIVE_ENABLED) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let wsRetryTimer: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const applyWireSession = (wire: WireSession) => {
      setSessions((prev) => {
        const next = new Map(prev);
        const existing = next.get(wire.fileName);
        const events = existing ? mergeEvents(existing.events, wire.events) : wire.events;
        next.set(wire.fileName, { meta: wire.meta, events });
        return next;
      });
      markActive(wire.fileName);
    };

    const pollOnce = async () => {
      try {
        const res = await fetch(`${API_SESSIONS_URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`sessions ${res.status}`);
        const index: ApiIndexEntry[] = await res.json();
        if (cancelled) return;
        if (statusRef.current !== 'ws') setStatusBoth('poll');

        for (const entry of index) {
          const prevEntry = knownIndexRef.current.get(entry.fileName);
          const changed =
            !prevEntry ||
            prevEntry.turnCount !== entry.turnCount ||
            prevEntry.toolCallCount !== entry.toolCallCount ||
            prevEntry.totalTokens !== entry.totalTokens;
          if (!changed) continue;
          knownIndexRef.current.set(entry.fileName, entry);

          try {
            const fileRes = await fetch(`${API_SESSIONS_URL}/${encodeURIComponent(entry.fileName)}?t=${Date.now()}`, {
              cache: 'no-store',
            });
            if (!fileRes.ok) continue;
            const parsed: { meta: SessionMeta; events: TimelineEvent[] } = await fileRes.json();
            if (cancelled) return;
            setSessions((prev) => {
              const next = new Map(prev);
              next.set(entry.fileName, parsed);
              return next;
            });
            markActive(entry.fileName);
          } catch {
            // one file failing shouldn't break the rest of the poll cycle
          }
        }
      } catch {
        if (!cancelled && statusRef.current !== 'ws') setStatusBoth('offline');
      }
    };

    const startPolling = () => {
      if (pollTimer) return;
      pollOnce();
      pollTimer = setInterval(pollOnce, POLL_INTERVAL_MS);
    };

    /** Opens one WS candidate; resolves true if it connected, false if it timed out/errored. */
    const connectOnce = (url: string): Promise<boolean> =>
      new Promise((resolve) => {
        if (cancelled) {
          resolve(false);
          return;
        }
        let settled = false;
        let socket: WebSocket;
        try {
          socket = new WebSocket(url);
        } catch {
          resolve(false);
          return;
        }

        const timeoutId = setTimeout(() => {
          if (settled) return;
          settled = true;
          socket.close();
          resolve(false);
        }, WS_CONNECT_TIMEOUT_MS);

        socket.onopen = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          currentSocketRef.current = socket;
          stopPolling();
          setStatusBoth('ws');
          resolve(true);
        };

        socket.onmessage = (ev) => {
          if (cancelled || socket !== currentSocketRef.current) return;
          let msg: { type: string; sessions?: WireSession[]; session?: WireSession };
          try {
            msg = JSON.parse(ev.data);
          } catch {
            return;
          }
          if (msg.type === 'hello' && msg.sessions) {
            setSessions((prev) => {
              const next = new Map(prev);
              for (const s of msg.sessions!) next.set(s.fileName, { meta: s.meta, events: s.events });
              return next;
            });
          } else if ((msg.type === 'session-new' || msg.type === 'update') && msg.session) {
            applyWireSession(msg.session);
          }
        };

        socket.onclose = () => {
          clearTimeout(timeoutId);
          if (!settled) {
            settled = true;
            resolve(false);
            return;
          }
          // this was the live connection — it dropped after being open
          if (cancelled || socket !== currentSocketRef.current) return;
          currentSocketRef.current = null;
          setStatusBoth('poll');
          startPolling();
        };

        socket.onerror = () => {
          // onclose fires right after in browsers — let that branch settle the promise
        };
      });

    const tryConnectWs = async () => {
      for (const url of wsCandidateUrls()) {
        if (cancelled) return;
        const ok = await connectOnce(url);
        if (ok) return;
      }
      if (!cancelled) startPolling();
    };

    tryConnectWs();

    // while not connected over WS, periodically retry the upgrade — lets the
    // tab pick up a daemon that starts after the page already loaded
    wsRetryTimer = setInterval(() => {
      if (cancelled || statusRef.current === 'ws') return;
      connectOnce(`ws://localhost:${WS_PORT}`);
    }, WS_RETRY_INTERVAL_MS);

    return () => {
      cancelled = true;
      stopPolling();
      if (wsRetryTimer) clearInterval(wsRetryTimer);
      if (activeFadeTimer.current) clearTimeout(activeFadeTimer.current);
      currentSocketRef.current?.close();
      currentSocketRef.current = null;
    };
  }, []);

  return { sessions: Array.from(sessions.values()), status, activeFileName };
}
