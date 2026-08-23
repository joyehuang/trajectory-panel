// GET /api/sessions/<fileName-or-sessionId> — full Session (meta + events),
// same shape src/parse.ts#parseSession produces, so the frontend renders it
// without any translation layer.

import { getClient, rowToMeta } from '../_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  const { id } = req.query;
  if (!id) {
    res.status(400).json({ error: 'missing id' });
    return;
  }
  try {
    const db = getClient();
    const sessionResult = await db.execute({
      sql: `SELECT * FROM sessions WHERE file_name = ? OR id = ? LIMIT 1`,
      args: [id, id],
    });
    const sessionRow = sessionResult.rows[0];
    if (!sessionRow) {
      res.status(404).json({ error: 'session not found' });
      return;
    }
    const eventsResult = await db.execute({
      sql: `SELECT payload FROM events WHERE session_id = ? ORDER BY seq ASC`,
      args: [sessionRow.id],
    });
    const events = eventsResult.rows.map((row) => JSON.parse(row.payload));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ meta: rowToMeta(sessionRow), events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
