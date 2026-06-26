import { db } from './db';
import { supabase } from './supabase';
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
    let hasErrors = false;

    // Push pending records
    for (const table of SYNC_TABLES) {
      const pending = await db.table(table).where('sync_status').equals('pending').toArray();
      if (pending.length === 0) continue;

      // Strip sync_status before sending to Supabase
      const rows = pending.map(({ sync_status, ...rest }: any) => rest);

      const { error } = await supabase
        .from(table)
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        console.error(`[sync] Error upserting ${table}:`, error.message);
        hasErrors = true;
      } else {
        // Mark as synced only on success
        for (const rec of pending) {
          await db.table(table).update(rec.id, { sync_status: 'synced' });
        }
        console.log(`[sync] Synced ${pending.length} records to ${table}`);
      }
    }

    // Push deletes
    const pendingDeletes = await db.deleted_records.where('sync_status').equals('pending').toArray();
    for (const del of pendingDeletes) {
      const { error } = await supabase.from(del.table).delete().eq('id', del.record_id);
      if (error) {
        console.error(`[sync] Error deleting from ${del.table}:`, error.message);
        hasErrors = true;
      } else {
        await db.deleted_records.delete(del.id);
      }
    }

    onSyncStatusChange?.(hasErrors ? 'error' : 'synced');
  } catch (err) {
    console.error('[sync] Sync error:', err);
    onSyncStatusChange?.('error');
  } finally {
    syncing = false;
  }
}

export async function pullFromCloud() {
  if (!navigator.onLine) return;
  try {
    onSyncStatusChange?.('syncing');

    for (const table of SYNC_TABLES) {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        console.error(`[sync] Error pulling ${table}:`, error.message);
        continue;
      }
      if (!data || data.length === 0) continue;

      for (const row of data) {
        const existing = await db.table(table).get(row.id);
        if (!existing || new Date(row.updated_at || row.created_at || 0) > new Date(existing.updated_at || existing.created_at || 0)) {
          await db.table(table).put({ ...row, sync_status: 'synced' });
        }
      }
    }

    onSyncStatusChange?.('synced');
  } catch (err) {
    console.error('[sync] Pull error:', err);
    onSyncStatusChange?.('error');
  }
}
