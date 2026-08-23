// GET /api/sessions — session summaries, newest activity first.
// Same shape the v3 R2 index.json used, so the frontend poll path is a
// drop-in replacement (see src/hooks/useLiveSessions.ts).

import { getClient } from './_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  try {
    const db = getClient();
    const result = await db.execute(
      `SELECT file_name, id, timestamp, model_id, turn_count, tool_call_count, total_tokens
       FROM sessions
       ORDER BY last_seen_at DESC
       LIMIT 50`,
    );
    const index = result.rows.map((row) => ({
      fileName: row.file_name,
      sessionId: row.id,
      timestamp: row.timestamp,
      modelId: row.model_id,
      turnCount: row.turn_count,
      toolCallCount: row.tool_call_count,
      totalTokens: row.total_tokens,
    }));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(index);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
