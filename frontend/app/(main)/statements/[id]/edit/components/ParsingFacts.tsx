import Box from '@mui/material/Box';
import type { StatementParsingDetails } from '@/app/lib/contracts';

interface ParsingFactsProps {
  details: StatementParsingDetails;
  labels: Record<string, { value: string } | undefined>;
}

type Fact = { label?: string; value: string | number; tone?: string };

/**
 * What the parser found, as one quiet line: label in grey, value in ink.
 * Unknown values are left out instead of shown as "—", and the warning count is
 * the list below, so it is not repeated here.
 */
export function ParsingFacts({ details, labels }: ParsingFactsProps): React.JSX.Element | null {
  const facts: Fact[] = [
    { label: labels.bank?.value, value: details.detectedBank ?? '' },
    { label: labels.bankDetectedBy?.value, value: details.detectedBy ?? '' },
    { label: labels.format?.value, value: details.detectedFormat?.toUpperCase() ?? '' },
    { label: labels.foundTransactions?.value, value: details.transactionsFound ?? '' },
    // Equal to "found" says nothing new.
    {
      label: labels.createdTransactions?.value,
      value:
        details.transactionsCreated === details.transactionsFound
          ? ''
          : (details.transactionsCreated ?? ''),
    },
    {
      label: labels.errors?.value,
      value: details.errors?.length || '',
      tone: 'var(--money-down)',
    },
    { label: labels.otherBankMentions?.value, value: details.otherBankMentions?.join(', ') ?? '' },
  ].filter(fact => fact.value !== '');

  if (facts.length === 0) {
    return null;
  }

  return (
    <Box
      component="dl"
      sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3, rowGap: 1, m: 0, fontSize: 13 }}
    >
      {facts.map(fact => (
        <Box key={fact.label} sx={{ display: 'flex', gap: 0.75 }}>
          <Box component="dt" sx={{ color: 'var(--text-muted)' }}>
            {fact.label}
          </Box>
          <Box
            component="dd"
            sx={{
              m: 0,
              fontWeight: 500,
              color: fact.tone ?? 'var(--foreground)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fact.value}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
