/**
 * The What's new marker as the user carries it: the newest changelog entry seen
 * (its stable id from changelog.json) and that entry's date, or the sign-up time
 * for an account that has seen none yet. `undefined` means a user object that
 * came without the fields (login answers leave them out).
 */
export interface ChangelogMarker {
  changelogSeenId?: string | null;
  changelogSeenAt?: string | null;
}

export interface DatedEntry {
  id: string;
  date: string;
}

/**
 * Whether `entry` is newer than what the user has seen. A missing marker never
 * counts as "not seen", so a partial user object does not open the dialog. Both
 * marker fields null is an account from before the marker existed: the latest
 * entry is new to it once. Otherwise the entry's date decides, so an id this
 * client does not know (a newer deploy marked it, or it left the list) still
 * compares by when it was released.
 */
export function isChangelogEntryUnseen(entry: DatedEntry, marker: ChangelogMarker): boolean {
  if (marker.changelogSeenId === undefined || marker.changelogSeenAt === undefined) {
    return false;
  }
  if (marker.changelogSeenId === entry.id) {
    return false;
  }
  const released = Date.parse(entry.date);
  if (Number.isNaN(released)) {
    return false;
  }
  if (marker.changelogSeenAt === null) {
    return true;
  }
  const seen = Date.parse(marker.changelogSeenAt);
  return Number.isNaN(seen) || released > seen;
}

/** The later of two markers: an answer to an older request cannot undo a newer one. */
export function laterMarker(
  current: ChangelogMarker,
  next: { changelogSeenId: string | null; changelogSeenAt: string | null },
): ChangelogMarker {
  if (next.changelogSeenAt === null) {
    return current;
  }
  if (current.changelogSeenAt == null) {
    return next;
  }
  return Date.parse(next.changelogSeenAt) > Date.parse(current.changelogSeenAt) ? next : current;
}
