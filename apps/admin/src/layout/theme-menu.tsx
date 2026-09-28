// Aurora ThemeToggler, ThemeList and PrimaryColorPicker. No route/query side effects.
import { useState } from 'react';
import {
  Box,
  Button,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  Radio,
  Stack,
  Typography,
  keyframes,
  listItemButtonClasses,
  listItemIconClasses,
  buttonBaseClasses,
} from '@mui/material';
import { themePresets, type ThemePreset } from '../theme/config.js';
import { useAppearance } from '../theme/preferences.js';
import { allPalettes, THEME_DISPLAY_NAMES } from '../theme/palettes/index.js';
import { COLOR_GROUPS } from '../theme/primaryColorOverride.js';
import IconifyIcon from './primitives/iconify-icon.js';

const spin = keyframes`from { transform: rotate(0deg); } to { transform: rotate(360deg); }`;
const rowSx = (nested = false) => ({
  minHeight: 36,
  py: 0,
  bgcolor: 'background.menu',
  pl: nested ? 4 : 2,
  [`&.${listItemButtonClasses.selected}`]: {
    bgcolor:
      'rgba(var(--holita-palette-primary-mainChannel) / var(--holita-palette-action-selectedOpacity))',
  },
  '&:hover': { bgcolor: 'action.hover' },
  [`& .${listItemIconClasses.root}`]: {
    minWidth: 36,
    [`& .${buttonBaseClasses.root}`]: {
      width: 22,
      height: 22,
      '& input': { width: 22, height: 22 },
    },
  },
});
function ThemeRadio({ checked }: { checked: boolean }) {
  return (
    <Radio
      checked={checked}
      tabIndex={-1}
      slotProps={{ input: { readOnly: true, 'aria-hidden': true } }}
      disableRipple
      sx={{ p: 0, pointerEvents: 'none', '& svg': { fontSize: 22 } }}
      checkedIcon={
        <IconifyIcon
          icon="material-symbols-light:check-circle"
          sx={{ fontSize: 20, color: 'primary.main' }}
        />
      }
    />
  );
}
export default function ThemeMenu() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [defaultOpen, setDefaultOpen] = useState(true);
  const { appearance, isDark, setPreset, setMode, setPrimaryColor } = useAppearance();
  const currentPreset =
    appearance.mode === 'system' ? (isDark ? 'default-dark' : 'default-light') : appearance.preset;
  const primaryColor = appearance.primaryColor ?? allPalettes[currentPreset].primary.main;
  const themeRow = (preset: ThemePreset, nested = false) => {
    const palette = allPalettes[preset];
    const checked = appearance.mode !== 'system' && appearance.preset === preset;
    return (
      <ListItem disablePadding key={preset}>
        <ListItemButton
          role="menuitemradio"
          aria-checked={checked}
          dense
          selected={checked}
          onClick={() => {
            setPreset(preset);
          }}
          sx={rowSx(nested)}
        >
          <ListItemIcon>
            <ThemeRadio checked={checked} />
          </ListItemIcon>
          <ListItemText primary={THEME_DISPLAY_NAMES[preset] ?? preset} />
          <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center' }}>
            {[palette.primary.main, palette.background.menu].map((color, index) => (
              <Box
                key={index}
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: 0.5,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: color,
                }}
              />
            ))}
          </Stack>
        </ListItemButton>
      </ListItem>
    );
  };
  return (
    <>
      <Box
        sx={{
          position: 'relative',
          width: 39,
          height: 39,
          flexShrink: 0,
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: 7.5,
            zIndex: 2,
            background: ({ vars }) =>
              `linear-gradient(to bottom, ${vars.palette.secondary.main}, transparent)`,
            animation: `${spin} 4s linear infinite`,
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 1,
            borderRadius: 7.5,
            zIndex: 1,
            bgcolor: 'secondary.light',
          },
        }}
      >
        <Button
          shape="circle"
          color="neutral"
          variant="soft"
          aria-label="Theme"
          aria-haspopup="menu"
          aria-expanded={Boolean(anchorEl)}
          onClick={(event) => {
            setAnchorEl(event.currentTarget);
          }}
          sx={{
            position: 'absolute',
            zIndex: 10,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <IconifyIcon
            icon="material-symbols-light:palette-outline"
            sx={{ fontSize: 22, position: 'relative', zIndex: 5 }}
          />
        </Button>
      </Box>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => {
          setAnchorEl(null);
        }}
        disableScrollLock
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 288 } }, list: { 'aria-label': 'Theme presets' } }}
      >
        <Box sx={{ [`& .${listItemButtonClasses.root}`]: { borderRadius: 0 } }}>
          <List dense disablePadding>
            <ListItem
              dense
              disablePadding
              secondaryAction={
                <IconButton
                  edge="end"
                  aria-label="Show default themes"
                  aria-expanded={defaultOpen}
                  onClick={() => {
                    setDefaultOpen(!defaultOpen);
                  }}
                >
                  <IconifyIcon
                    icon={
                      defaultOpen
                        ? 'material-symbols:keyboard-arrow-up-rounded'
                        : 'material-symbols:keyboard-arrow-down-rounded'
                    }
                  />
                </IconButton>
              }
            >
              <ListItemButton
                dense
                selected={appearance.preset.startsWith('default-')}
                onClick={() => {
                  setPreset('default-light');
                }}
                sx={rowSx()}
              >
                <ListItemIcon>
                  <ThemeRadio checked={appearance.preset.startsWith('default-')} />
                </ListItemIcon>
                <ListItemText primary="Default" />
              </ListItemButton>
            </ListItem>
            <Collapse in={defaultOpen} timeout="auto" unmountOnExit>
              <List dense disablePadding>
                {themeRow('default-light', true)}
                {themeRow('default-dark', true)}
                <ListItem
                  disablePadding
                  secondaryAction={
                    <IconifyIcon
                      icon="material-symbols:monitor-outline-rounded"
                      fontSize={18}
                      display="block"
                    />
                  }
                >
                  <ListItemButton
                    role="menuitemradio"
                    aria-checked={appearance.mode === 'system'}
                    dense
                    selected={appearance.mode === 'system'}
                    onClick={() => {
                      setMode('system');
                    }}
                    sx={rowSx(true)}
                  >
                    <ListItemIcon>
                      <ThemeRadio checked={appearance.mode === 'system'} />
                    </ListItemIcon>
                    <ListItemText primary="System" />
                  </ListItemButton>
                </ListItem>
              </List>
            </Collapse>
            {themePresets
              .filter((preset) => !preset.startsWith('default-'))
              .map((preset) => themeRow(preset))}
          </List>
          <Stack sx={{ gap: 1, justifyContent: 'space-between', p: 2, pb: 1 }}>
            <Typography
              variant="subtitle2"
              sx={{ color: 'text.secondary', fontWeight: 600, minWidth: 100 }}
            >
              Primary Color
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '5px' }}>
              {COLOR_GROUPS.map((group) => (
                <Box
                  component="button"
                  key={group.key}
                  aria-label={`Primary color ${THEME_DISPLAY_NAMES[group.key] ?? group.key}`}
                  aria-pressed={primaryColor === group.main}
                  onClick={() => {
                    setPrimaryColor(group.main);
                  }}
                  sx={{
                    position: 'relative',
                    width: 24,
                    height: 24,
                    border: 0,
                    p: 0,
                    borderRadius: 1,
                    bgcolor: group.main,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'text.primary',
                      outlineOffset: 2,
                    },
                  }}
                >
                  {primaryColor === group.main && (
                    <IconifyIcon
                      icon="material-symbols:check"
                      sx={{ fontSize: 14, color: 'background.default' }}
                    />
                  )}
                </Box>
              ))}
            </Box>
          </Stack>
        </Box>
      </Menu>
    </>
  );
}
