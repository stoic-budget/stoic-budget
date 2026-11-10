import { describe, expect, it } from 'vitest';
import { isChangelogEntryUnseen, laterMarker } from '@/app/lib/changelog-seen';

const older = { id: 'changelog-2026-10-01-aaaaaaa', date: '2026-10-01T09:00:00.000Z' };
const sameDayEarlier = { id: 'changelog-2026-10-20-ccccccc', date: '2026-10-20T08:00:00.000Z' };
const latest = { id: 'changelog-2026-10-20-bbbbbbb', date: '2026-10-20T18:00:00.000Z' };

const seen = (entry: { id: string; date: string } | null, at = entry?.date ?? null) => ({
  changelogSeenId: entry?.id ?? null,
  changelogSeenAt: at,
});

describe('isChangelogEntryUnseen', () => {
  it('is false for the entry the marker names', () => {
    expect(isChangelogEntryUnseen(latest, seen(latest))).toBe(false);
  });

  it('is true when the marker names an older entry', () => {
    expect(isChangelogEntryUnseen(latest, seen(older))).toBe(true);
  });

  it('orders entries of one day by their time, not by the id', () => {
    // The sha in the id sorts the other way round.
    expect(isChangelogEntryUnseen(latest, seen(sameDayEarlier))).toBe(true);
    expect(isChangelogEntryUnseen(sameDayEarlier, seen(latest))).toBe(false);
  });

  it('compares an id it does not know by the stored date', () => {
    const unknownNewer = { id: 'changelog-2026-11-02-eeeeeee', date: '2026-11-02T10:00:00.000Z' };
    const unknownOlder = { id: 'changelog-2026-09-02-fffffff', date: '2026-09-02T10:00:00.000Z' };

    expect(isChangelogEntryUnseen(latest, seen(unknownNewer))).toBe(false);
    expect(isChangelogEntryUnseen(latest, seen(unknownOlder))).toBe(true);
  });

  it('treats a new account, which starts at its sign-up time, as having seen older releases', () => {
    const signedUpAfter = seen(null, '2026-10-21T00:00:00.000Z');
    const signedUpBefore = seen(null, '2026-10-19T00:00:00.000Z');

    expect(isChangelogEntryUnseen(latest, signedUpAfter)).toBe(false);
    expect(isChangelogEntryUnseen(latest, signedUpBefore)).toBe(true);
  });

  it('shows the latest entry once to an account from before the marker (both null)', () => {
    expect(isChangelogEntryUnseen(latest, seen(null))).toBe(true);
  });

  it('never counts a user without the fields as not seen', () => {
    expect(isChangelogEntryUnseen(latest, {})).toBe(false);
    expect(isChangelogEntryUnseen(latest, { changelogSeenId: null })).toBe(false);
  });

  it('ignores an entry without a readable date', () => {
    expect(isChangelogEntryUnseen({ id: 'changelog-x', date: 'soon' }, seen(null))).toBe(false);
  });
});

describe('laterMarker', () => {
  it('keeps a newer local marker over an answer to an older request', () => {
    expect(laterMarker(seen(latest), seen(older))).toEqual(seen(latest));
  });

  it('takes a newer answer, also over a local guess', () => {
    expect(laterMarker(seen(older), seen(latest))).toEqual(seen(latest));
    expect(laterMarker({}, seen(older))).toEqual(seen(older));
    expect(laterMarker(seen(null), seen(older))).toEqual(seen(older));
  });

  it('ignores an empty answer', () => {
    expect(laterMarker(seen(older), seen(null))).toEqual(seen(older));
  });
});
