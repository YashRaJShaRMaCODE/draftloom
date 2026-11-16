export const DRAFT_RETENTION_OPTIONS = [15, 240, 1440];

export function isDraftExpired(savedAt, retentionMinutes, now = Date.now()) {
  const timestamp = Number(savedAt);
  return Number.isFinite(timestamp) && timestamp > 0 && now - timestamp >= retentionMinutes * 60_000;
}

export function purgeExpiredDrafts(storage, retentionMinutes, now = Date.now()) {
  if (!isDraftExpired(storage.getItem("clear-writing:draft:v1:saved-at"), retentionMinutes, now)) return false;
  for (const key of ["clear-writing:draft:v1", "clear-writing:previous-draft:v1"]) {
    storage.removeItem(key);
    storage.removeItem(`${key}:saved-at`);
  }
  return true;
}
