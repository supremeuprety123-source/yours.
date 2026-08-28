import { db } from './db';
import { supabase } from './supabase';
import type { TableName } from './types';

const SYNC_TABLES: TableName[] = [
  'profile', 'papers', 'chapters', 'lessons', 'revision_history',
  'routines', 'focus_sessions', 'categories', 'transactions',
  'diary_entries', 'life_notes', 'exams', 'mock_scores', 'day_logs'
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
  syncTimer = setTimeout(() => doSync(), 1500);
}

export async function doSync() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  onSyncStatusChange?.('syncing');

  try {
    let hasErrors = false;

    // Push pending records
    for (const table of SYNC_TABLES) {
      try {
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
          for (const rec of pending) {
            await db.table(table).update(rec.id, { sync_status: 'synced' });
          }
          console.log(`[sync] Synced ${pending.length} records to ${table}`);
        }
      } catch (tableErr) {
        console.error(`[sync] Table ${table} push failed:`, tableErr);
        hasErrors = true;
      }
    }

    // Push deletes
    try {
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
    } catch (delErr) {
      console.error('[sync] Delete push failed:', delErr);
      hasErrors = true;
    }

    onSyncStatusChange?.(hasErrors ? 'error' : 'synced');
  } catch (err) {
    console.error('[sync] Sync error:', err);
    onSyncStatusChange?.('error');
  } finally {
    syncing = false;
  }
}

/** Pull all cloud data into local DB. Returns true if any data was pulled. */
export async function pullFromCloud(): Promise<boolean> {
  if (!navigator.onLine) return false;
  let anyData = false;
  try {
    onSyncStatusChange?.('syncing');

    for (const table of SYNC_TABLES) {
      try {
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
          // mock_scores may not exist yet on older Supabase — skip quietly
          if (table === 'mock_scores' || table === 'day_logs') {
            console.warn(`[sync] ${table} missing on cloud — run updated SQL`);
            continue;
          }
          console.error(`[sync] Error pulling ${table}:`, error.message);
          continue;
        }
        if (!data || data.length === 0) continue;
        anyData = true;

        for (const row of data) {
          const existing = await db.table(table).get(row.id);
          const remoteTime = new Date(row.updated_at || row.created_at || 0).getTime();
          const localTime = existing
            ? new Date((existing as any).updated_at || (existing as any).created_at || 0).getTime()
            : 0;
          // Prefer newer remote, or always take if no local
          if (!existing || remoteTime >= localTime) {
            await db.table(table).put({ ...row, sync_status: 'synced' });
          }
        }
      } catch (tableErr) {
        console.error(`[sync] Pull ${table} failed:`, tableErr);
      }
    }

    onSyncStatusChange?.('synced');
  } catch (err) {
    console.error('[sync] Pull error:', err);
    onSyncStatusChange?.('error');
  }
  return anyData;
}

/** Full bidirectional sync: pull then push, for use after login / focus */
export async function fullSync(): Promise<void> {
  if (!navigator.onLine || syncing) return;
  await pullFromCloud();
  await doSync();
}
