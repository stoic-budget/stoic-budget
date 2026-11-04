/**
 * Where the text a balance label's amount is read from ends: the label's own
 * line, or the next one when the label stands alone and its amount is printed
 * under it with its date ("Ending balance" / "on September 24, 2024 $122.45").
 * Another balance label on the same line ends it too: a summary of two columns
 * prints "Previous Balance $916.96   New Balance $203.39" as one line.
 * `folded` is the statement folded by `foldText`; undefined means the end.
 */
export function balanceLineEnd(
  folded: string,
  index: number,
  labels: readonly string[] = [],
): number | undefined {
  const end = lineEnd(folded, index);
  const rest = folded.slice(index, end);
  const others = labels
    .map(label => new RegExp(`(?:^|[^a-z])${label}(?![a-z])`).exec(rest)?.index)
    .filter((at): at is number => at !== undefined);
  return others.length > 0 ? index + Math.min(...others) : end;
}

function lineEnd(folded: string, index: number): number | undefined {
  const end = folded.indexOf('\n', index);
  if (end === -1) {
    return undefined;
  }
  if (
    folded.slice(index, end).trim() !== '' ||
    !/^[ \t]*(?:on|as of|as at)\s/.test(folded.slice(end + 1))
  ) {
    return end;
  }
  const next = folded.indexOf('\n', end + 1);
  return next === -1 ? undefined : next;
}
