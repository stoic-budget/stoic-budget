'use client';

import Button from '@mui/material/Button';
import Link from 'next/link';
import { useState } from 'react';
import { ImportFromFileButton } from '@/app/components/import-wizard/ImportFromFileButton';
import type { ImportPeriod } from '@/app/components/import-wizard/import-choices';
import { fillTemplateNodes } from '@/app/components/ui/private-amount';
import { ReadOnlyHint } from '@/app/components/versions/ReadOnlyHint';
import { useIntlayer, useLocale } from '@/app/i18n';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import type { Account } from '../hooks/useAccounts';
import { useStatementCoverage } from '../hooks/useStatementCoverage';
import {
  cardStyle,
  figureStyle,
  formatDay,
  listRowStyle,
  mutedStyle,
  titleStyle,
} from './account-detail-styles';
import { CoverageMonths } from './CoverageMonths';
import { type CoverageProblem, coverageProblems } from './coverage-problems';

/** A handful of problems says enough until asked for the rest. */
const PROBLEMS_SHOWN = 5;

/** Puts dates (never hidden) into a template; amounts go through `fillTemplateNodes`. */
const withDates = (template: string, dates: Record<string, string>): string =>
  Object.entries(dates).reduce(
    (text, [key, value]) => text.split(`{{${key}}}`).join(value),
    template,
  );

const textStyle = { fontSize: 14, color: 'var(--foreground)', minWidth: 0 } as const;

/**
 * Which days the account's statements cover, month by month, and what is
 * wrong with them: days no statement covers (each opens the import held to
 * those days), balances that do not chain from one statement to the next,
 * statements whose rows do not add up, overlaps and second copies.
 */
export function AccountCoverageCard({
  account,
  money,
}: {
  account: Account;
  /** An amount in the account's currency. */
  money: (value: number) => string;
}): React.JSX.Element | null {
  const t = useIntlayer('accountsPage');
  const { locale } = useLocale();
  const coverage = useStatementCoverage(account.id);
  const [showAll, setShowAll] = useState(false);
  const [period, setPeriod] = useState<ImportPeriod | undefined>(undefined);
  if (!coverage) {
    return null;
  }
  const day = (date: string) => formatDay(date, locale);
  const problems = coverageProblems(coverage);
  const shown = showAll ? problems : problems.slice(0, PROBLEMS_SHOWN);

  const importButton = (from: string, to: string, openImport: () => void) => (
    <ReadOnlyHint>
      <Button
        size="small"
        variant="text"
        onClick={() => {
          setPeriod({ from, to });
          openImport();
        }}
      >
        {t.coverageImport}
      </Button>
    </ReadOnlyHint>
  );
  const statementLink = (statementId: string, children: React.ReactNode) => (
    <Link href={`/statements/${statementId}/edit`} style={{ ...textStyle, textDecoration: 'none' }}>
      {children}
    </Link>
  );
  const row = (problem: CoverageProblem, openImport: () => void): React.ReactNode => {
    switch (problem.kind) {
      case 'gap':
      case 'sinceLast': {
        const template = problem.kind === 'gap' ? t.coverageGap.value : t.coverageSinceLast.value;
        return (
          <>
            <span style={textStyle}>
              {withDates(template, { from: day(problem.from), to: day(problem.to) })}
            </span>
            {importButton(problem.from, problem.to, openImport)}
          </>
        );
      }
      case 'chain':
        return statementLink(
          problem.statementId,
          fillTemplateNodes(withDates(t.coverageChainBreak.value, { date: day(problem.date) }), {
            closing: money(problem.closing),
            opening: money(problem.opening),
          }),
        );
      case 'movement':
        return statementLink(
          problem.statementId,
          fillTemplateNodes(
            withDates(t.coverageMovement.value, { from: day(problem.from), to: day(problem.to) }),
            { amount: money(Math.abs(problem.difference)) },
          ),
        );
      case 'overlap':
        return statementLink(
          problem.statementId,
          withDates(t.coverageOverlap.value, { from: day(problem.from), to: day(problem.to) }),
        );
      case 'duplicate':
        return statementLink(
          problem.statementId,
          withDates(t.coverageDuplicate.value, { name: problem.fileName }),
        );
    }
  };

  // One import for every gap, outside the list: the dialog stays open on its result even
  // once the import has closed the gap it came from.
  return (
    <ImportFromFileButton
      target="transactions"
      account={{ id: account.id, currency: account.currency, period }}
      onImported={() => invalidateFinancialData()}
      renderTrigger={open => (
        <section style={cardStyle} data-testid="account-coverage">
          <h2 style={titleStyle}>{t.coverageTitle}</h2>
          {coverage.firstDay === null || coverage.lastDay === null ? (
            <span style={mutedStyle}>{t.coverageNone}</span>
          ) : (
            <>
              <span style={mutedStyle}>
                {withDates(t.coverageRange.value, {
                  from: day(coverage.firstDay),
                  to: day(coverage.lastDay),
                })}
              </span>
              {coverage.unexplained !== 0 && (
                <span style={figureStyle}>
                  {fillTemplateNodes(t.coverageUnexplained.value, {
                    amount: money(coverage.unexplained),
                  })}
                </span>
              )}
              <CoverageMonths months={coverage.months} />
              {problems.length === 0 ? (
                <span style={mutedStyle}>{t.coverageAllGood}</span>
              ) : (
                <div>
                  {shown.map(problem => (
                    <div key={problem.key} style={listRowStyle} data-problem={problem.kind}>
                      {row(problem, open)}
                    </div>
                  ))}
                  {problems.length > PROBLEMS_SHOWN && !showAll && (
                    <Button variant="text" onClick={() => setShowAll(true)}>
                      {t.coverageShowAll.value.replace('{{count}}', String(problems.length))}
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}
    />
  );
}
