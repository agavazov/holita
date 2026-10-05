import { useTranslation } from 'react-i18next';
// Aurora Member FilterDrawer; the owning feature supplies the filter controls.
import {
  Box,
  Button,
  Drawer,
  Stack,
  Typography,
  drawerClasses,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { ReactNode } from 'react';
import IconifyIcon from '../layout/primitives/iconify-icon.js';

export function FilterDrawer({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const persistent = useMediaQuery(theme.breakpoints.up('xl'));
  return (
    <Drawer
      variant={persistent ? 'persistent' : 'temporary'}
      open={open}
      onClose={onClose}
      slotProps={{ paper: { role: persistent ? 'region' : 'dialog', 'aria-label': label } }}
      sx={{
        width: persistent && open ? 280 : 0,
        flexShrink: 0,
        transition: theme.transitions.create('width'),
        [`& .${drawerClasses.paper}`]: {
          width: 280,
          maxWidth: '100vw',
          border: 0,
          bgcolor: 'background.elevation1',
          outline: `1px solid ${theme.vars.palette.divider}`,
          ...(persistent
            ? { position: 'sticky', top: 83, height: 'calc(100vh - 83px)', zIndex: 'unset' }
            : {}),
        },
      }}
    >
      <Box component="aside" sx={{ px: 3, py: 2 }}>
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', mb: 2, alignItems: 'center' }}
        >
          <Typography variant="h6" component="h2">
            {t('actions.filter')}
          </Typography>
          <Button
            shape="circle"
            color="neutral"
            aria-label={t('actions.closeFilters')}
            onClick={onClose}
          >
            <IconifyIcon icon="material-symbols:close-rounded" sx={{ fontSize: 20 }} />
          </Button>
        </Stack>
        <Stack sx={{ gap: 2 }}>{children}</Stack>
      </Box>
    </Drawer>
  );
}
