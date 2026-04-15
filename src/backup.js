/**
 * Daily R2 backup — copies all board data into a date-prefixed snapshot
 * in the backup bucket, then prunes snapshots older than 7 days.
 */

const RETENTION_DAYS = 7;

export async function runBackup(env) {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const prefix = 'boards/';
  let copied = 0;
  let cursor;

  // 1. Copy every object under boards/ to BACKUP_BUCKET/{date}/boards/...
  do {
    const listed = await env.BUCKET.list({ prefix, cursor });
    for (const obj of listed.objects) {
      const data = await env.BUCKET.get(obj.key);
      if (data) {
        await env.BACKUP_BUCKET.put(`${date}/${obj.key}`, data.body, {
          httpMetadata: data.httpMetadata,
          customMetadata: data.customMetadata,
        });
        copied++;
      }
    }
    cursor = listed.truncated ? listed.cursor : null;
  } while (cursor);

  // 2. Prune snapshots older than RETENTION_DAYS
  const pruned = await pruneOldSnapshots(env);

  return { date, copied, pruned };
}

async function pruneOldSnapshots(env) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // List top-level date prefixes in the backup bucket
  const listed = await env.BACKUP_BUCKET.list({ delimiter: '/' });
  const oldPrefixes = (listed.delimitedPrefixes || []).filter(p => {
    const dateStr = p.replace('/', '');
    return dateStr < cutoffStr;
  });

  let pruned = 0;
  for (const prefix of oldPrefixes) {
    pruned += await deletePrefix(env.BACKUP_BUCKET, prefix);
  }
  return pruned;
}

async function deletePrefix(bucket, prefix) {
  let deleted = 0;
  let cursor;
  do {
    const listed = await bucket.list({ prefix, cursor });
    for (const obj of listed.objects) {
      await bucket.delete(obj.key);
      deleted++;
    }
    cursor = listed.truncated ? listed.cursor : null;
  } while (cursor);
  return deleted;
}
