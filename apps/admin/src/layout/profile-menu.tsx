// Aurora ProfileMenu with an explicit example profile and local presentation actions.
import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Switch,
  Typography,
  listClasses,
  listItemIconClasses,
  paperClasses,
} from '@mui/material';
import { useAppearance } from '../theme/preferences.js';
import { useLocalization } from '../localization/localization-provider.js';
import IconifyIcon from './primitives/iconify-icon.js';
import type { ShellIcon } from './primitives/icons.js';
import StatusAvatar from './primitives/status-avatar.js';
import { exampleProfile as user } from './demo-data.js';

export default function ProfileMenu({ sidebar = false }: { sidebar?: boolean }) {
  const { t } = useLocalization();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [examplePage, setExamplePage] = useState<string | null>(null);
  const { isDark, setMode } = useAppearance();
  const close = () => {
    setAnchorEl(null);
  };
  const showExample = (name: string) => {
    close();
    setExamplePage(name);
  };
  const item = (label: string, icon: ShellIcon) => (
    <MenuItem
      key={label}
      onClick={() => {
        showExample(label);
      }}
      sx={{ gap: 1 }}
    >
      <ListItemIcon sx={{ [`&.${listItemIconClasses.root}`]: { minWidth: 'unset !important' } }}>
        <IconifyIcon icon={icon} sx={{ color: 'text.secondary' }} />
      </ListItemIcon>
      {label}
    </MenuItem>
  );
  return (
    <>
      {sidebar ? (
        <IconButton
          aria-label={t('shell.profilePreferences')}
          aria-haspopup="menu"
          aria-expanded={Boolean(anchorEl)}
          onClick={(event) => {
            setAnchorEl(event.currentTarget);
          }}
        >
          <IconifyIcon icon="material-symbols:settings-outline" />
        </IconButton>
      ) : (
        <Button
          color="neutral"
          variant="text"
          shape="circle"
          aria-label={t('shell.profile')}
          aria-haspopup="menu"
          aria-expanded={Boolean(anchorEl)}
          onClick={(event) => {
            setAnchorEl(event.currentTarget);
          }}
          sx={{ height: 44, width: 44 }}
        >
          <StatusAvatar
            alt={t(user.nameKey)}
            src={user.avatar}
            sx={{ width: 40, height: 40, border: 2, borderColor: 'background.paper' }}
          />
        </Button>
      )}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={close}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{ list: { 'aria-label': t('shell.profile') } }}
        sx={{
          [`& .${paperClasses.root}`]: { minWidth: { xs: 288, sm: 320 } },
          [`& .${listClasses.root}`]: { py: 0 },
        }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', gap: 2, px: 3, py: 2 }}>
          <StatusAvatar alt={t(user.nameKey)} src={user.avatar} sx={{ width: 48, height: 48 }} />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
              {t(user.nameKey)}
            </Typography>
            <Typography variant="subtitle2" sx={{ color: 'warning.main' }}>
              {t(user.designationKey)}
              <IconifyIcon
                icon="material-symbols:diamond-rounded"
                color="warning.main"
                sx={{ verticalAlign: 'text-bottom', ml: 0.5 }}
              />
            </Typography>
          </Box>
        </Stack>
        <Divider />
        <Box sx={{ py: 1 }}>
          {item(t('shell.accessibility'), 'material-symbols:accessible-forward-rounded')}
          {item(t('shell.preferences'), 'material-symbols:settings-outline-rounded')}
          <MenuItem
            role="menuitemcheckbox"
            aria-checked={isDark}
            onClick={() => {
              setMode(isDark ? 'light' : 'dark');
            }}
            sx={{ gap: 1 }}
          >
            <ListItemIcon sx={{ minWidth: 'unset !important' }}>
              <IconifyIcon
                icon="material-symbols:dark-mode-outline-rounded"
                sx={{ color: 'text.secondary' }}
              />
            </ListItemIcon>
            {t('shell.darkMode')}
            <Switch
              checked={isDark}
              tabIndex={-1}
              slotProps={{ input: { readOnly: true, 'aria-hidden': true } }}
              sx={{ ml: 'auto', pointerEvents: 'none' }}
            />
          </MenuItem>
        </Box>
        <Divider />
        <Box sx={{ py: 1 }}>
          {item(t('shell.accountSettings'), 'material-symbols:manage-accounts-outline-rounded')}
          {item(t('shell.helpCenter'), 'material-symbols:question-mark-rounded')}
        </Box>
        <Divider />
        <Typography
          variant="caption"
          component="li"
          sx={{ listStyle: 'none', color: 'text.secondary', px: 3, py: 2 }}
        >
          {t('shell.exampleProfileStatus')}
        </Typography>
      </Menu>
      <Dialog
        open={examplePage !== null}
        onClose={() => {
          setExamplePage(null);
        }}
        aria-labelledby="example-profile-title"
      >
        <DialogTitle id="example-profile-title">{examplePage}</DialogTitle>
        <DialogContent>{t('shell.exampleProfileMessage')}</DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setExamplePage(null);
            }}
          >
            {t('shell.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
