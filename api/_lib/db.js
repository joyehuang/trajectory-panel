// Shared Turso client for Vercel serverless functions. Credentials come from
// project env vars (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN) — never hardcoded.
// Underscore-prefixed dirs under api/ are not routed by Vercel, so this file
// is import-only, not an endpoint.

import { createClient } from '@libsql/client';

let client = null;

export function getClient() {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error('TURSO_DATABASE_URL / TURSO_AUTH_TOKEN not set');
  }
  client = createClient({ url, authToken });
  return client;
}

function emptyUsage() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 0, costTotal: 0 };
}

export function rowToMeta(row) {
  return {
    id: row.id,
    fileName: row.file_name,
    timestamp: row.timestamp,
    cwd: row.cwd,
    provider: row.provider,
    modelId: row.model_id,
    thinkingLevel: row.thinking_level,
    turnCount: row.turn_count,
    toolCallCount: row.tool_call_count,
    usageTotal: { ...emptyUsage(), totalTokens: row.total_tokens ?? 0, costTotal: row.cost_total ?? 0 },
  };
}
