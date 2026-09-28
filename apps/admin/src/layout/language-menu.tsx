// Aurora LanguageMenu. Selection is a local demo; the application remains in English.
import { useState } from 'react';
import { Button, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import IconifyIcon from './primitives/iconify-icon.js';
import type { ShellIcon } from './primitives/icons.js';
const languages: readonly { label: string; icon: ShellIcon; currency: string }[] = [
  { label: 'English', icon: 'twemoji:flag-united-kingdom', currency: '$' },
  { label: 'French', icon: 'twemoji:flag-france', currency: '€' },
  { label: 'Bengali', icon: 'twemoji:flag-bangladesh', currency: '৳' },
  { label: 'Chinese', icon: 'twemoji:flag-china', currency: '¥' },
  { label: 'Hindi', icon: 'twemoji:flag-india', currency: '₹' },
  { label: 'Arabic', icon: 'twemoji:flag-saudi-arabia', currency: '﷼' },
];
export default function LanguageMenu() {
  const [language, setLanguage] = useState(languages[0]);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button
        color="neutral"
        variant="text"
        shape="circle"
        aria-label="Language"
        aria-haspopup="menu"
        aria-expanded={Boolean(anchorEl)}
        onClick={(event) => {
          setAnchorEl(event.currentTarget);
        }}
      >
        <IconifyIcon icon={language?.icon ?? 'twemoji:flag-united-kingdom'} sx={{ fontSize: 24 }} />
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => {
          setAnchorEl(null);
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{ list: { 'aria-label': 'Example language selection' } }}
      >
        {languages.map((entry) => (
          <MenuItem
            key={entry.label}
            role="menuitemradio"
            aria-checked={entry.label === language?.label}
            selected={entry.label === language?.label}
            onClick={() => {
              setLanguage(entry);
              setAnchorEl(null);
            }}
            sx={{ minWidth: 200 }}
          >
            <ListItemIcon>
              <IconifyIcon icon={entry.icon} sx={{ fontSize: 24 }} />
            </ListItemIcon>
            <ListItemText primary={entry.label} slotProps={{ primary: { sx: { fontSize: 14 } } }} />
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 'normal' }}>
              {entry.currency}
            </Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
