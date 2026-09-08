import { db } from './db';
import { supabase } from './supabase';
import type { TableName } from './types';

/** Every user data table — must match Supabase + Dexie */
export const SYNC_TABLES: TableName[] = [
  'profile',
  'papers',
  'chapters',
  'lessons',
  'revision_history',
  'routines',
  'focus_sessions',
  'categories',
  'transactions',
  'diary_entries',
  'life_notes',
  'exams',
  'mock_scores',
  'day_logs',
];

/** Tables that may not exist yet on older Supabase projects */
const OPTIONAL_TABLES = new Set<TableName>(['mock_scores', 'day_logs']);

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
  syncTimer = setTimeout(() => doSync(), 1200);
}

/** Push all pending local rows + deletes to Supabase */
export async function doSync() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  onSyncStatusChange?.('syncing');

  try {
    let hasErrors = false;

    for (const table of SYNC_TABLES) {
      try {
        const pending = await db.table(table).where('sync_status').equals('pending').toArray();
        if (pending.length === 0) continue;

        const rows = pending.map(({ sync_status, ...rest }: any) => rest);

        const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });

        if (error) {
          console.error(`[sync] Error upserting ${table}:`, error.message);
          if (OPTIONAL_TABLES.has(table)) {
            console.warn(`[sync] ${table} missing on cloud — run updated SQL`);
          } else {
            hasErrors = true;
          }
        } else {
          for (const rec of pending) {
            await db.table(table).update(rec.id, { sync_status: 'synced' });
          }
          console.log(`[sync] Pushed ${pending.length} → ${table}`);
        }
      } catch (tableErr) {
        console.error(`[sync] Table ${table} push failed:`, tableErr);
        hasErrors = true;
      }
    }

    // Push deletes so other devices drop the same rows
    try {
      const pendingDeletes = await db.deleted_records.where('sync_status').equals('pending').toArray();
      for (const del of pendingDeletes) {
        const { error } = await supabase.from(del.table).delete().eq('id', del.record_id);
        if (error) {
          console.error(`[sync] Error deleting from ${del.table}:`, error.message);
          // Still clear local delete marker if remote row already gone
          if (String(error.message || '').toLowerCase().includes('not find')) {
            await db.deleted_records.delete(del.id);
          } else {
            hasErrors = true;
          }
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

/**
 * Pull cloud → local.
 * - Upserts newer remote rows
 * - Removes local rows that were deleted on another device (synced only; pending local kept)
 */
export async function pullFromCloud(): Promise<boolean> {
  if (!navigator.onLine) return false;
  let anyData = false;

  try {
    onSyncStatusChange?.('syncing');

    for (const table of SYNC_TABLES) {
      try {
        const { data, error } = await supabase.from(table).select('*');

        if (error) {
          if (OPTIONAL_TABLES.has(table)) {
            console.warn(`[sync] ${table} missing on cloud — run updated SQL`);
          } else {
            console.error(`[sync] Error pulling ${table}:`, error.message);
          }
          continue;
        }

        if (!data) continue;

        const remoteIds = new Set(data.map((row: any) => row.id));

        // Drop local copies deleted on another device (only already-synced rows)
        const localRows = await db.table(table).toArray();
        for (const local of localRows) {
          const status = (local as any).sync_status;
          if (status === 'pending') continue; // not uploaded yet — keep
          if (!remoteIds.has((local as any).id)) {
            await db.table(table).delete((local as any).id);
          }
        }

        if (data.length === 0) continue;
        anyData = true;

        for (const row of data) {
          const existing = await db.table(table).get(row.id);
          const remoteTime = new Date(row.updated_at || row.created_at || row.completed_at || 0).getTime();
          const localTime = existing
            ? new Date(
                (existing as any).updated_at ||
                  (existing as any).created_at ||
                  (existing as any).completed_at ||
                  0
              ).getTime()
            : 0;

          // Prefer newer remote; never overwrite pending local edits with older cloud data
          if (existing && (existing as any).sync_status === 'pending' && localTime > remoteTime) {
            continue;
          }

          if (!existing || remoteTime >= localTime) {
            await db.table(table).put({ ...row, sync_status: 'synced' });
          }
        }

        console.log(`[sync] Pulled ${data.length} ← ${table}`);
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

/** Full bidirectional sync: pull then push */
export async function fullSync(): Promise<void> {
  if (!navigator.onLine) return;
  // Avoid overlapping full syncs, but allow if stuck
  if (syncing) {
    console.log('[sync] fullSync skipped — already syncing');
    return;
  }
  await pullFromCloud();
  await doSync();
}

/** Force every local row to re-upload (repair tool) */
export async function markAllPending(): Promise<void> {
  for (const table of SYNC_TABLES) {
    try {
      const rows = await db.table(table).toArray();
      for (const row of rows) {
        await db.table(table).update((row as any).id, { sync_status: 'pending' });
      }
    } catch (e) {
      console.error(`[sync] markAllPending ${table}:`, e);
    }
  }
}
