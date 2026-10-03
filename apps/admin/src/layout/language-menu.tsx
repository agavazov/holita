import { useState } from 'react';
import { Button, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { useLocation, useNavigate } from 'react-router';

import { useLocalization } from '../localization/localization-provider.js';
import { switchPathLocale, type AdminLocale } from '../localization/locale.js';
import IconifyIcon from './primitives/iconify-icon.js';
import type { ShellIcon } from './primitives/icons.js';

const languages = [
  { locale: 'bg', label: 'Български', icon: 'twemoji:flag-bulgaria' },
  { locale: 'en', label: 'English', icon: 'twemoji:flag-united-kingdom' },
] as const satisfies readonly { locale: AdminLocale; label: string; icon: ShellIcon }[];

const languageByLocale: Record<AdminLocale, (typeof languages)[number]> = {
  bg: languages[0],
  en: languages[1],
};

export default function LanguageMenu({ disabled = false }: { disabled?: boolean }) {
  const { locale, t } = useLocalization();
  const location = useLocation();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const language = languageByLocale[locale];

  return (
    <>
      <Button
        color="neutral"
        variant="text"
        shape="circle"
        aria-label={t('common.language')}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchorEl)}
        disabled={disabled}
        onClick={(event) => {
          setAnchorEl(event.currentTarget);
        }}
      >
        <IconifyIcon icon={language.icon} sx={{ fontSize: 24 }} />
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => {
          setAnchorEl(null);
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{ list: { 'aria-label': t('common.language') } }}
      >
        {languages.map((entry) => (
          <MenuItem
            key={entry.locale}
            role="menuitemradio"
            aria-checked={entry.locale === locale}
            selected={entry.locale === locale}
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              void navigate({
                pathname: switchPathLocale(location.pathname, entry.locale),
                search: location.search,
                hash: location.hash,
              });
              setAnchorEl(null);
            }}
            sx={{ minWidth: 200 }}
          >
            <ListItemIcon>
              <IconifyIcon icon={entry.icon} sx={{ fontSize: 24 }} />
            </ListItemIcon>
            <ListItemText
              primary={entry.label}
              slotProps={{ primary: { sx: { fontSize: 14 } } }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
