/** The dates an import from an account's gap is held to, `YYYY-MM-DD`, both ends included. */
export interface ImportPeriod {
  from: string;
  to: string;
}

/** What the person chose for the sheet besides the column roles. */
export interface ImportChoices {
  currency: string;
  categorize: boolean;
  /** Transactions only: the account the rows go to, '' to let the server find it. */
  walletId: string;
  /** Opened from a gap between an account's statements: its dates. */
  period: ImportPeriod | null;
  /** Import only the rows dated in `period`. */
  heldToPeriod: boolean;
}

/** Opened from an account, its rows go there in its currency, held to its gap when one was picked. */
export const initialImportChoices = (
  account: { id: string; currency: string; period?: ImportPeriod } | undefined,
  workspaceCurrency: string,
): ImportChoices => ({
  currency: account?.currency ?? workspaceCurrency,
  categorize: true,
  walletId: account?.id ?? '',
  period: account?.period ?? null,
  heldToPeriod: Boolean(account?.period),
});
