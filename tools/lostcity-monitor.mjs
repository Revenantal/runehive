import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const WEALTH_LABELS = [
  'Trade',
  'PvP',
  'Stake',
  'Death',
  'Drop',
  'Pickup',
  'Shop buy',
  'Shop sell',
  'Low alchemy',
  'High alchemy',
  'Party room',
];
const WEALTH_CASE = `CASE w.event_type ${WEALTH_LABELS.map((label, i) => `WHEN ${i} THEN '${label}'`).join(' ')} ELSE 'Wealth event ' || w.event_type END`;
const SESSION = `SELECT l.id, l.timestamp, COALESCE(a.username, '(unknown)') AS player,
  CASE WHEN l.event = 'Server check in' THEN 'position' ELSE 'session' END AS category,
  l.event AS event, l.coord AS coord
  FROM session_log l LEFT JOIN session s ON s.uuid = l.session_uuid
  LEFT JOIN account a ON a.id = s.account_id`;
const WEALTH = `SELECT w.id, w.timestamp, COALESCE(a.username, '(unknown)') AS player,
  'wealth' AS category, ${WEALTH_CASE} || ': ' || COALESCE(w.account_items, '[]') || ' (value ' || w.account_value || ')' AS event, w.coord AS coord
  FROM session_wealth w LEFT JOIN session s ON s.uuid = w.session_uuid
  LEFT JOIN account a ON a.id = s.account_id`;
const QUERY = `SELECT * FROM (SELECT * FROM (${SESSION}) UNION ALL SELECT * FROM (${WEALTH}))
  WHERE (? = '' OR lower(player) = lower(?)) AND (? = '' OR instr(lower(event), lower(?)) > 0)
    AND (? = 'all' OR category = ?)`;

/** Formats an event on one line without allowing control characters into the terminal. */
function formatEvent(row) {
  const coord =
    row.category === 'position' && Number.isInteger(row.coord)
      ? ` (level ${(row.coord >> 28) & 3}, x ${(row.coord >> 14) & 16383}, z ${row.coord & 16383})`
      : '';
  return [row.timestamp, row.player, row.category, `${row.event}${coord}`]
    .map((value) =>
      [...String(value)]
        .map((char) => {
          const code = char.codePointAt(0);
          return code < 32 || (code >= 127 && code <= 159) ? ' ' : char;
        })
        .join(''),
    )
    .join(' | ');
}

/** Displays recent events and optionally polls for subsequent matching events. */
export async function monitor({
  root,
  destination,
  player,
  event,
  category,
  interval,
  limit,
  once,
}) {
  const dbPath = path.resolve(root, destination, 'engine', 'db.sqlite');
  if (!existsSync(dbPath))
    throw new Error('LostCity SQLite database is missing; start the configured world first.');
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const filters = [player, player, event, event, category, category];
    const max = db.prepare(
      'SELECT (SELECT COALESCE(MAX(id), 0) FROM session_log) AS session, (SELECT COALESCE(MAX(id), 0) FROM session_wealth) AS wealth',
    );
    const initial = db.prepare(
      `${QUERY} AND ((category = 'wealth' AND id <= ?) OR (category <> 'wealth' AND id <= ?)) ORDER BY timestamp DESC, category DESC, id DESC LIMIT ?`,
    );
    const next = db.prepare(
      `${QUERY} AND ((category = 'wealth' AND id > ? AND id <= ?) OR (category <> 'wealth' AND id > ? AND id <= ?)) ORDER BY timestamp ASC, category ASC, id ASC`,
    );
    let cursor = max.get();
    const latest = initial.all(...filters, cursor.wealth, cursor.session, limit).reverse();
    console.log(`Player events (up to ${limit} recent matches):`);
    for (const row of latest) console.log(formatEvent(row));
    if (once) return;
    console.log('Watching for new events; press Ctrl-C to stop.');
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, interval * 1000));
      const end = max.get();
      const rows = next.all(...filters, cursor.wealth, end.wealth, cursor.session, end.session);
      for (const row of rows) console.log(formatEvent(row));
      // Advance only to the captured high-water mark; events arriving during the query remain visible.
      cursor = end;
    }
  } finally {
    db.close();
  }
}
