import { db } from './db';
import type { TableName } from './types';

const SYNC_TABLES: TableName[] = [
  'profile', 'papers', 'chapters', 'lessons', 'revision_history',
  'routines', 'focus_sessions', 'categories', 'transactions',
  'diary_entries', 'life_notes', 'exams'
];

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;
let onSyncStatusChange: ((status: string) => void) | null = null;

export function setSyncCallback(cb: (status: string) => void) {
  onSyncStatusChange = cb;
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function triggerSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => doSync(), 2000);
}

export async function doSync() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  onSyncStatusChange?.('syncing');

  try {
    // Push pending records
    const operations: { table: string; rows: any[] }[] = [];
    for (const table of SYNC_TABLES) {
      const pending = await db.table(table).where('sync_status').equals('pending').toArray();
      if (pending.length > 0) {
        operations.push({ table, rows: pending.map(({ sync_status, ...rest }: any) => rest) });
      }
    }

    if (operations.length > 0) {
      await fetch('/api/sync', {
 method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations }),
      });
      // Mark as synced
      for (const table of SYNC_TABLES) {
        const pending = await db.table(table).where('sync_status').equals('pending').toArray();
        for (const rec of pending) {
          await db.table(table).update(rec.id, { sync_status: 'synced' });
        }
      }
    }

    // Push deletes
    const pendingDeletes = await db.deleted_records.where('sync_status').equals('pending').toArray();
    if (pendingDeletes.length > 0) {
      for (const del of pendingDeletes) {
        await fetch('/api/sync', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: del.table, id: del.record_id }),
        });
        await db.deleted_records.delete(del.id);
      }
    }

    onSyncStatusChange?.('synced');
  } catch (err) {
    console.error('Sync error:', err);
    onSyncStatusChange?.('error');
  } finally {
    syncing = false;
  }
}

export async function pullFromCloud() {
  if (!navigator.onLine) return;
  try {
    onSyncStatusChange?.('syncing');
    const res = await fetch('/api/sync');
    if (!res.ok) return;
    const data = await res.json();
    for (const table of SYNC_TABLES) {
      const rows = data[table] || [];
      if (rows.length === 0) continue;
      for (const row of rows) {
        const existing = await db.table(table).get(row.id);
        if (!existing || new Date(row.updated_at || row.created_at || 0) > new Date(existing.updated_at || existing.created_at || 0)) {
          await db.table(table).put({ ...row, sync_status: 'synced' });
        }
      }
    }
    onSyncStatusChange?.('synced');
  } catch (err) {
    console.error('Pull error:', err);
    onSyncStatusChange?.('error');
  }
}
