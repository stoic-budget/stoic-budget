'use client';

import Box from '@mui/material/Box';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { ChevronRight } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

/** One plugin or integration: opens its settings, with its switch beside it. */
export function PluginRow({
  name,
  description,
  icon,
  active,
  openable,
  status,
  canToggle,
  pending,
  onToggle,
  onOpen,
  dataAttributes,
}: {
  name: string;
  description: React.ReactNode;
  icon: React.ReactNode;
  active: boolean;
  openable: boolean;
  /** Connection state, for integrations. */
  status?: React.ReactNode;
  canToggle: boolean;
  pending: boolean;
  onToggle: (enabled: boolean) => void;
  onOpen: () => void;
  dataAttributes?: Record<string, string>;
}): React.JSX.Element {
  const t = useIntlayer('pluginsPage');

  return (
    <Box
      {...dataAttributes}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        borderRadius: tokens.radius.md,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={onOpen}
        disabled={!openable}
        sx={{
          display: 'flex',
          flex: 1,
          minWidth: 0,
          alignItems: 'center',
          gap: 1.5,
          px: 1,
          py: 1.25,
          border: 'none',
          bgcolor: 'transparent',
          textAlign: 'left',
          color: 'text.primary',
          cursor: openable ? 'pointer' : 'default',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: tokens.radius.sm,
            bgcolor: 'action.hover',
            color: active ? 'primary.main' : 'text.secondary',
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{name}</Typography>
          <Typography
            sx={{
              fontSize: 12,
              color: 'text.secondary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {description}
          </Typography>
        </Box>
        {status}
        {openable ? <ChevronRight size={16} style={{ flexShrink: 0, opacity: 0.5 }} /> : null}
      </Box>
      <Tooltip title={canToggle ? '' : t.adminOnlyToggle.value}>
        <span>
          <Switch
            checked={active}
            onChange={(_event, checked) => onToggle(checked)}
            disabled={!canToggle || pending}
            size="small"
            slotProps={{ input: { 'aria-label': t.toggle.value.replace('{name}', name) } }}
            sx={{ mr: 0.5 }}
          />
        </span>
      </Tooltip>
    </Box>
  );
}
