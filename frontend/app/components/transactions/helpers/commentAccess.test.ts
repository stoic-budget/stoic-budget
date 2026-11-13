import { describe, expect, it } from 'vitest';
import { canReadComment } from './commentAccess';

describe('canReadComment', () => {
  const me = 'member-self';
  const partner = 'member-partner';

  it('lets anyone read the comment of a shared row', () => {
    expect(canReadComment({ isPrivate: false, ownerMemberId: partner, comments: 'Lunch' }, me)).toBe(
      true,
    );
    expect(canReadComment({ isPrivate: false, comments: 'Lunch' }, null)).toBe(true);
  });

  it('lets the owner of a private row read it, and nobody else', () => {
    expect(canReadComment({ isPrivate: true, ownerMemberId: me, comments: 'A gift' }, me)).toBe(
      true,
    );
    expect(canReadComment({ isPrivate: true, ownerMemberId: partner, comments: '—' }, me)).toBe(
      false,
    );
    // Not knowing who the viewer is reads as "not theirs".
    expect(canReadComment({ isPrivate: true, ownerMemberId: me, comments: 'A gift' }, null)).toBe(
      false,
    );
  });

  it('never offers the redaction placeholder as a comment to edit', () => {
    expect(canReadComment({ isPrivate: true, ownerMemberId: me, comments: '—' }, me)).toBe(false);
  });
});
