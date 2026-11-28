/** A small stable hash for the rotation below. */
export function hash(text: string): number {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) {
    value = (value * 31 + text.charCodeAt(index)) >>> 0;
  }
  return value;
}

/** Each workspace has its own rotation of wordings, moving on month by month. */
export const rotation = (workspaceId: string, month: Date) =>
  hash(workspaceId) + month.getFullYear() * 12 + month.getMonth();
