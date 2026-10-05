// Aurora LanguageMenu with application-owned locale selection.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import IconifyIcon from './primitives/iconify-icon.js';
import type { Language } from '../i18n/i18n.js';
import type { ShellIcon } from './primitives/icons.js';
const languages: readonly { code: Language; label: string; icon: ShellIcon }[] = [
  { code: 'bg', label: 'Български', icon: 'twemoji:flag-bulgaria' },
  { code: 'en', label: 'English', icon: 'twemoji:flag-united-kingdom' },
];
export default function LanguageMenu({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  const { t } = useTranslation('shell');
  const label = t('language.label');
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button
        color="neutral"
        variant="text"
        shape="circle"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchorEl)}
        onClick={(event) => {
          setAnchorEl(event.currentTarget);
        }}
      >
        <IconifyIcon
          icon={language === 'bg' ? 'twemoji:flag-bulgaria' : 'twemoji:flag-united-kingdom'}
          sx={{ fontSize: 24 }}
        />
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => {
          setAnchorEl(null);
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{ list: { 'aria-label': label } }}
      >
        {languages.map((entry) => (
          <MenuItem
            key={entry.label}
            role="menuitemradio"
            aria-checked={entry.code === language}
            selected={entry.code === language}
            onClick={() => {
              onChange(entry.code);
              setAnchorEl(null);
            }}
            sx={{ minWidth: 200 }}
          >
            <ListItemIcon>
              <IconifyIcon icon={entry.icon} sx={{ fontSize: 24 }} />
            </ListItemIcon>
            <ListItemText primary={entry.label} slotProps={{ primary: { sx: { fontSize: 14 } } }} />
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 'normal' }}>
              {entry.code.toUpperCase()}
            </Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
