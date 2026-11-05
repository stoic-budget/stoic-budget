export const isTaken = (name: string, names: string[]): boolean => {
  const key = name.trim().toLocaleLowerCase();
  return names.some(existing => existing.trim().toLocaleLowerCase() === key);
};

/** "Transactions", or "Transactions 2" when a table of that name is already there. */
export function distinctName(base: string, names: string[]): string {
  let candidate = base;
  for (let n = 2; isTaken(candidate, names); n++) {
    candidate = `${base} ${n}`;
  }
  return candidate;
}
