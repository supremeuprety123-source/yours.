import { db } from './db';
import { triggerSync } from './sync';

function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

export async function getAll<T>(table: string): Promise<T[]> {
  return db.table(table).toArray();
}

export async function getById<T>(table: string, id: string): Promise<T | undefined> {
  return db.table(table).get(id);
}

export async function addRecord<T extends { id?: string }>(
  table: string,
  data: Partial<T> & Record<string, any>
): Promise<T> {
  const record = {
    ...data,
    id: data.id || uid(),
    updated_at: now(),
    sync_status: 'pending',
  } as unknown as T;
  await db.table(table).put(record);
  triggerSync();
  return record;
}

export async function updateRecord<T>(
  table: string,
  id: string,
  changes: Partial<T> & Record<string, any>
): Promise<void> {
  const existing = await db.table(table).get(id);
  if (!existing) return;
  await db.table(table).put({
    ...existing,
    ...changes,
    updated_at: now(),
    sync_status: 'pending',
  });
  triggerSync();
}

export async function removeRecord(table: string, id: string): Promise<void> {
  const existing = await db.table(table).get(id);
  await db.table(table).delete(id);
  // Track deletion for sync
  await db.deleted_records.put({
    id: uid(),
    table,
    record_id: id,
    deleted_at: now(),
    sync_status: 'pending',
  });
  triggerSync();
}

// Cascade delete helper
export async function removeWithChildren(
  table: string,
  id: string,
  children: { table: string; fk: string; grandChildren?: { table: string; fk: string }[] }[]
): Promise<void> {
  for (const child of children) {
    const childRecords = await db.table(child.table).where(child.fk).equals(id).toArray();
    for (const childRec of childRecords) {
      if (child.grandChildren) {
        await removeWithChildren(child.table, childRec.id, child.grandChildren.map(gc => ({ table: gc.table, fk: gc.fk })));
      } else {
        await removeRecord(child.table, childRec.id);
      }
    }
  }
  await removeRecord(table, id);
}

export { db };
