// Adapted from Aurora layouts/main-layout/sidenav/StackedSidenav.tsx.
import { useState } from 'react';
import {
  Backdrop,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListSubheader,
  Stack,
  Toolbar,
  Typography,
  drawerClasses,
} from '@mui/material';
import { cssVarRgba } from '../theme/utils.js';
import { useAppearance } from '../theme/preferences.js';
import IconifyIcon from './primitives/iconify-icon.js';
import Logo from './primitives/logo.js';
import StatusAvatar from './primitives/status-avatar.js';
import { exampleProfile } from './demo-data.js';
import NavItem from './nav-item.js';
import ProfileMenu from './profile-menu.js';
import { containsSection, type NavigationGroup } from './types.js';

type Props = {
  groups: readonly NavigationGroup[];
  section: string;
  collapsed: boolean;
  tablet: boolean;
  width: number;
  onToggle: () => void;
  onNavigate: (section: string) => void;
};
export default function StackedSidenav({
  groups,
  section,
  collapsed,
  tablet,
  width,
  onToggle,
  onNavigate,
}: Props) {
  const activeGroup = groups.find((group) => containsSection(group.items, section)) ?? groups[0];
  const [selectedKey, setSelectedKey] = useState(activeGroup?.key);
  const [lastSection, setLastSection] = useState(section);
  const [mouseEntered, setMouseEntered] = useState(false);
  const [focusEntered, setFocusEntered] = useState(false);
  if (lastSection !== section) {
    setLastSection(section);
    setSelectedKey(activeGroup?.key);
    setMouseEntered(false);
    setFocusEntered(false);
  }
  const selectedMenu = groups.find((group) => group.key === selectedKey) ?? activeGroup;
  const expanded = collapsed && (mouseEntered || focusEntered);
  const { isDark } = useAppearance();
  const navigate = (next: string) => {
    setMouseEntered(false);
    setFocusEntered(false);
    onNavigate(next);
  };
  return (
    <Box
      component="nav"
      aria-label="Workspace navigation"
      className="stacked-sidenav"
      sx={{
        width: { md: width },
        flexShrink: { sm: 0 },
        position: { md: 'absolute', lg: expanded ? 'absolute' : 'static' },
        transition: (theme) =>
          theme.transitions.create('width', { duration: theme.transitions.duration.standard }),
        ...(expanded && { width: { lg: 300 }, '~ main': { ml: '72px' } }),
      }}
    >
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          [`& .${drawerClasses.paper}`]: {
            boxSizing: 'border-box',
            width: expanded ? 300 : width,
            transition: (theme) =>
              theme.transitions.create('width', { duration: theme.transitions.duration.standard }),
          },
        }}
      >
        <Box
          sx={{ flex: 1, overflow: 'hidden' }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && collapsed) {
              setMouseEntered(false);
              setFocusEntered(false);
              event.currentTarget
                .querySelector<HTMLButtonElement>('button[aria-label="Expand navigation"]')
                ?.focus();
            }
          }}
          onMouseLeave={() => {
            setMouseEntered(false);
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setFocusEntered(false);
          }}
        >
          <Stack direction="row" sx={{ height: 1 }}>
            <Box
              className="leftside-panel"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                width: 72,
                flexShrink: 0,
                bgcolor: 'background.elevation2',
              }}
            >
              <Toolbar
                variant="appbar"
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Logo showName={false} />
              </Toolbar>
              <Box sx={{ p: 2, flex: 1 }}>
                <List aria-label="Navigation groups" sx={{ py: 0 }}>
                  {groups.map((group) => (
                    <ListItem
                      key={group.key}
                      sx={{
                        p: 0,
                        pb: 1,
                        position: 'relative',
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          width: 30,
                          top: 0,
                          bottom: 0,
                          left: '100%',
                          zIndex: 100,
                        },
                      }}
                      onMouseEnter={() => {
                        if (collapsed) {
                          setMouseEntered(true);
                          setSelectedKey(group.key);
                        }
                      }}
                    >
                      <IconButton
                        aria-label={`${group.label} navigation`}
                        aria-pressed={selectedMenu?.key === group.key}
                        color="primary"
                        onFocus={() => {
                          if (collapsed) {
                            setFocusEntered(true);
                            setSelectedKey(group.key);
                          }
                        }}
                        onClick={() => {
                          setSelectedKey(group.key);
                          if (collapsed) setFocusEntered(true);
                        }}
                        sx={{
                          color: activeGroup?.key === group.key ? 'primary.main' : 'text.secondary',
                          borderRadius: 2,
                          '&:hover': {
                            bgcolor: ({ vars }) =>
                              cssVarRgba(vars.palette.common.whiteChannel, isDark ? 0.1 : 0.7),
                          },
                          ...(selectedMenu?.key === group.key && {
                            bgcolor: ({ vars }) =>
                              cssVarRgba(vars.palette.common.whiteChannel, isDark ? 0.1 : 0.7),
                          }),
                        }}
                      >
                        <IconifyIcon icon={group.icon} sx={{ fontSize: 24 }} />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              </Box>
              <Toolbar sx={{ padding: '0 !important', display: 'flex', justifyContent: 'center' }}>
                <IconButton
                  aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                  onClick={() => {
                    setFocusEntered(false);
                    setMouseEntered(false);
                    onToggle();
                  }}
                  sx={{ color: 'text.secondary' }}
                >
                  <IconifyIcon
                    icon={
                      collapsed
                        ? 'material-symbols:left-panel-open-outline'
                        : 'material-symbols:left-panel-close-outline'
                    }
                  />
                </IconButton>
              </Toolbar>
            </Box>
            <Box
              onMouseEnter={() => {
                if (collapsed) setMouseEntered(true);
              }}
              sx={{
                overflow: 'hidden',
                flex: 1,
                px: 1,
                position: 'relative',
                visibility: collapsed && !expanded ? 'hidden' : 'visible',
              }}
            >
              <Toolbar variant="appbar" sx={{ p: { xs: 2 }, pr: { xs: 1 } }}>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1, width: 1 }}>
                  <StatusAvatar
                    alt={exampleProfile.name}
                    src={exampleProfile.avatar}
                    sx={{ width: 36, height: 36 }}
                  />
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}
                  >
                    {exampleProfile.name}
                  </Typography>
                  <Box sx={{ ml: 'auto' }}>
                    <ProfileMenu sidebar />
                  </Box>
                </Stack>
              </Toolbar>
              <Box sx={{ pt: 2 }}>
                <List
                  dense
                  role="menu"
                  aria-label={selectedMenu?.label ?? 'Navigation'}
                  subheader={
                    <ListSubheader
                      component="div"
                      disableGutters
                      sx={{
                        typography: 'body1',
                        textAlign: 'left',
                        color: 'text.primary',
                        fontWeight: 700,
                        py: 1,
                        pl: 2,
                        mb: 1,
                        bgcolor: 'transparent',
                        position: 'static',
                      }}
                    >
                      {selectedMenu?.label}
                    </ListSubheader>
                  }
                >
                  {selectedMenu?.items.map((item) => (
                    <NavItem key={item.key} item={item} section={section} onNavigate={navigate} />
                  ))}
                </List>
              </Box>
            </Box>
          </Stack>
        </Box>
        <Divider />
      </Drawer>
      {tablet && <Backdrop open={!collapsed} sx={{ zIndex: 1199 }} onClick={onToggle} />}
    </Box>
  );
}
