'use client';
import { Box, Button, Paper, Typography } from '@mui/material';
import { Layers, Trash2 } from '@/app/components/icons';
import { formatLabel } from '../editHelpers';

type Label = { value: string } | undefined;

/** The bar over the rows while some are ticked: how many, assign a category, delete. Wraps on a phone. */
export function BulkSelectionBar({
  count,
  labels,
  saving,
  onAssignCategory,
  onDelete,
}: {
  count: number;
  labels: Record<string, Label>;
  saving: boolean;
  onAssignCategory: () => void;
  onDelete: (confirmMessage: string) => void;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        mb: 3,
        p: { xs: 2, sm: 3 },
        bgcolor: 'primary.50',
        border: '1px solid',
        borderColor: 'primary.200',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography
          variant="body1"
          sx={{ fontWeight: 500, color: 'primary.700', fontSize: '0.9375rem' }}
        >
          {formatLabel(labels.selectedTransactions?.value, { count }) ||
            `Selected: ${count} transactions`}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          <Button
            variant="outlined"
            onClick={onAssignCategory}
            startIcon={<Layers size={18} />}
            disabled={saving}
            size="small"
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              borderColor: 'primary.300',
              color: 'primary.700',
              '&:hover': { borderColor: 'primary.400', bgcolor: 'primary.100' },
            }}
          >
            {labels.assignCategory?.value}
          </Button>
          <Button
            variant="outlined"
            onClick={() =>
              onDelete(
                formatLabel(labels.confirmDeleteMany?.value, { count }) ||
                  `Delete ${count} transactions?`,
              )
            }
            disabled={saving}
            startIcon={<Trash2 size={18} />}
            size="small"
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              color: 'var(--money-down)',
              borderColor: 'var(--border)',
              '&:hover': { borderColor: 'var(--money-down)', bgcolor: 'transparent' },
            }}
          >
            {labels.delete?.value}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
