'use client';

import { useIntlayer, useLocale } from '@/app/i18n';
import { fillTemplate } from '../import-wizard-utils';
import type { AppImportResult } from './app-import-api';

const MAX_PROBLEMS = 8;
const REASONS = ['date', 'amount', 'account', 'type'] as const;

/** `2026-10` as the locale writes a month: "October 2026". */
const monthName = (month: string, locale: string): string => {
  const [year, index] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, index - 1, 1)));
};

/** What the files bring, kind by kind, and the rows left out. */
export function AppImportSummary({ result }: { result: AppImportResult }): React.JSX.Element {
  const t = useIntlayer('appImport');
  const wizard = useIntlayer('importWizard');
  const { locale } = useLocale();
  const accounts = {
    created: result.accounts.filter(account => account.status === 'created').length,
    matched: result.accounts.filter(account => account.status === 'matched').length,
  };
  const lines: Array<[string, string]> = [
    [t.titles.accounts.value, fillTemplate(t.summaries.accounts.value, accounts)],
    [
      t.titles.categories.value,
      fillTemplate(t.summaries.categories.value, {
        created: result.categories.created,
        matched: result.categories.matched,
        groups: result.categories.groups,
      }),
    ],
    [t.titles.payees.value, fillTemplate(t.summaries.payees.value, result.payees)],
    [
      t.titles.transactions.value,
      fillTemplate(t.summaries.transactions.value, result.transactions),
    ],
    [
      t.titles.budgets.value,
      result.budgets.month
        ? fillTemplate(t.summaries.budgets.value, {
            created: result.budgets.created,
            updated: result.budgets.updated,
            month: monthName(result.budgets.month, locale),
          })
        : t.noPlan.value,
    ],
  ];
  const kept = result.accounts.filter(account => account.openingsSkipped > 0);
  const notes = [
    result.transactions.linked > 0 &&
      fillTemplate(t.notes.linked.value, { linked: result.transactions.linked }),
    kept.length > 0 &&
      fillTemplate(t.notes.openingsKept.value, {
        names: kept.map(account => account.name).join(', '),
      }),
  ].filter((note): note is string => Boolean(note));
  const reason = (code: string) =>
    REASONS.find(item => item === code) ? t.reasons[code as (typeof REASONS)[number]].value : code;

  return (
    <div className="seneca-ai__section" data-testid="app-import-summary">
      <dl className="seneca-ai__summary">
        {lines.map(([title, text]) => (
          <div key={title} className="seneca-ai__summary-row">
            <dt>{title}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
      {notes.map(note => (
        <p key={note} className="seneca-ai__note">
          {note}
        </p>
      ))}
      {result.problems.length > 0 && (
        <div className="seneca-iw__problems">
          <p className="seneca-iw__label">{wizard.issuesTitle}</p>
          <ul>
            {result.problems.slice(0, MAX_PROBLEMS).map(problem => (
              <li key={`${problem.fileName}-${problem.row}`}>
                <span className="seneca-iw__row-no">
                  {problem.fileName} · {fillTemplate(wizard.rowLabel.value, { row: problem.row })}
                </span>
                <span>{reason(problem.reason)}</span>
              </li>
            ))}
            {result.problems.length > MAX_PROBLEMS && <li>…</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
