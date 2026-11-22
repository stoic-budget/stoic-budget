import {
  appendNote,
  NOTE_SEPARATOR,
  tagsToAdd,
} from '../../../../src/modules/transactions/helpers/bulk-annotate-plan';

describe('bulk annotate plan', () => {
  const note = 'Shared with Member One';

  describe('appendNote', () => {
    it('puts the note on a row without a comment', () => {
      expect(appendNote(null, note)).toBe(note);
      expect(appendNote('   ', note)).toBe(note);
    });

    it('keeps the existing comment and adds the note after it', () => {
      expect(appendNote('ACME Store - Wireless Buds', note)).toBe(
        `ACME Store - Wireless Buds${NOTE_SEPARATOR}${note}`,
      );
    });

    it('trims the note and the end of the old comment, never its start', () => {
      expect(appendNote('  kept  ', `  ${note}  `)).toBe(`  kept${NOTE_SEPARATOR}${note}`);
    });

    it('changes nothing when the comment already ends with the note', () => {
      expect(appendNote(note, note)).toBeNull();
      expect(appendNote(`older${NOTE_SEPARATOR}${note}`, note)).toBeNull();
    });

    it('still adds a note that only ends the comment as part of a longer word', () => {
      expect(appendNote(`older${note}`, note)).toBe(`older${note}${NOTE_SEPARATOR}${note}`);
    });

    it('changes nothing for an empty note', () => {
      expect(appendNote('kept', '   ')).toBeNull();
    });
  });

  describe('tagsToAdd', () => {
    it('leaves out the tags the row has and repeats', () => {
      expect(tagsToAdd(['a', 'b'], ['b', 'c', 'c'])).toEqual(['c']);
    });

    it('adds nothing when the row has them all', () => {
      expect(tagsToAdd(['a', 'b'], ['a'])).toEqual([]);
    });
  });
});
