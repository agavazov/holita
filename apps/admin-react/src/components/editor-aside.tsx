// Aurora CreateEvent's aside, stacked below the fields on mobile.
import { Divider, Paper, Stack } from '@mui/material';
import type { ReactNode } from 'react';

export function EditorAside({
  label,
  children,
  actions,
}: {
  label: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <Paper
      component="aside"
      aria-label={label}
      background={1}
      sx={{
        position: { md: 'sticky' },
        top: { md: 83 },
        alignSelf: 'flex-start',
        width: { xs: '100%', md: 336, lg: 404 },
        flexShrink: 0,
        height: { md: 'calc(100vh - 83px)' },
        maxHeight: { md: 'calc(100vh - 83px)' },
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Stack divider={<Divider />} sx={{ overflowY: 'auto', minHeight: 0, flex: 1 }}>
        {children}
      </Stack>
      <Stack
        direction="row"
        sx={{ p: { xs: 3, lg: 5 }, gap: 1, flexWrap: 'wrap', borderTop: 1, borderColor: 'divider' }}
      >
        {actions}
      </Stack>
    </Paper>
  );
}
