import supabase from './db-client.js';

const TABLES = [
  'profile', 'papers', 'chapters', 'lessons', 'revision_history',
  'routines', 'focus_sessions', 'categories', 'transactions',
  'diary_entries', 'life_notes', 'exams'
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const result = {};
      for (const table of TABLES) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
          console.error(`Error fetching ${table}:`, error.message);
          result[table] = [];
        } else {
          result[table] = data || [];
        }
      }
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const { operations } = req.body;
      if (!Array.isArray(operations)) {
        return res.status(400).json({ error: 'operations must be an array' });
      }
      const results = [];
      for (const op of operations) {
        const { table, rows } = op;
        if (!TABLES.includes(table)) continue;
        if (!rows || rows.length === 0) continue;
        const { data, error } = await supabase
          .from(table)
          .upsert(rows, { onConflict: 'id' })
          .select();
        if (error) {
          console.error(`Error upserting ${table}:`, error.message);
          results.push({ table, error: error.message });
        } else {
          results.push({ table, count: data?.length || 0 });
        }
      }
      return res.status(200).json({ ok: true, results });
    }

    if (req.method === 'DELETE') {
      const { table, id } = req.body;
      if (!TABLES.includes(table)) {
        return res.status(400).json({ error: 'Invalid table' });
      }
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Sync API error:', err);
    res.status(500).json({ error: err.message });
  }
}
