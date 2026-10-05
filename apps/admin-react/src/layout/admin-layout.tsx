import { useTranslation } from 'react-i18next';
// Aurora MainLayout and AppBar with a simple single-column sidenav and no footer.
import { useEffect, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  MenuItem,
  Stack,
  Toolbar,
  drawerClasses,
  paperClasses,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import IconifyIcon from './primitives/iconify-icon.js';
import Logo from './primitives/logo.js';
import StyledTextField from './primitives/styled-text-field.js';
import Sidenav from './sidenav.js';
import SidenavContent from './sidenav-content.js';
import SearchBox from './search-box.js';
import LanguageMenu from './language-menu.js';
import ThemeMenu from './theme-menu.js';
import NotificationMenu from './notification-menu.js';
import ProfileMenu from './profile-menu.js';
import type { AdminLayoutProps } from './types.js';

function readCollapsed() {
  try {
    return localStorage.getItem('holita.sidenavCollapsed') === 'true';
  } catch {
    return false;
  }
}
function StoreSelector({
  stores,
  selectedStoreId,
  storesLoading,
  onStoreChange,
}: Pick<AdminLayoutProps, 'stores' | 'selectedStoreId' | 'storesLoading' | 'onStoreChange'>) {
  const { t } = useTranslation(['shell', 'stores']);
  return (
    <StyledTextField
      select
      id="store-switcher"
      label={t('stores:label')}
      size="small"
      value={selectedStoreId ?? ''}
      onChange={(event) => {
        onStoreChange(event.target.value);
      }}
      slotProps={{
        select: {
          displayEmpty: true,
          inputProps: { 'aria-label': t('stores:label'), 'aria-busy': storesLoading },
        },
      }}
      sx={{ width: { xs: '100%', md: 184 }, flexShrink: 0 }}
    >
      <MenuItem value="" disabled>
        {storesLoading ? t('stores:loading') : t('stores:select')}
      </MenuItem>
      {stores.map((store) => (
        <MenuItem value={store.id} key={store.id}>
          {store.name}
        </MenuItem>
      ))}
    </StyledTextField>
  );
}
export function AdminLayout(props: AdminLayoutProps) {
  const { t } = useTranslation('shell');
  const { selectedStoreId, selectedSection, onSectionChange, navigationGroups, children } = props;
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const wide = useMediaQuery(theme.breakpoints.up('lg'));
  const showName = useMediaQuery(theme.breakpoints.up('sm'));
  const [desktopCollapsed, setDesktopCollapsed] = useState(readCollapsed);
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const region = mobile ? 'mobile' : wide ? 'desktop' : 'tablet';
  const [lastRegion, setLastRegion] = useState(region);
  if (lastRegion !== region) {
    setLastRegion(region);
    setMobileOpen(false);
    setTabletExpanded(false);
  }
  useEffect(() => {
    try {
      localStorage.setItem('holita.sidenavCollapsed', String(desktopCollapsed));
    } catch {
      /* Navigation also works without persistent storage. */
    }
  }, [desktopCollapsed]);
  const collapsed = wide ? desktopCollapsed : !tabletExpanded;
  const drawerWidth = mobile ? 0 : collapsed ? 72 : 256;
  const groups = selectedStoreId ? navigationGroups : [];
  const toggleCollapsed = () => {
    if (wide) setDesktopCollapsed(!desktopCollapsed);
    else setTabletExpanded(!tabletExpanded);
  };
  const navigate = (section: string) => {
    setMobileOpen(false);
    setTabletExpanded(false);
    onSectionChange(section);
  };
  const modeIndicator = (
    <Chip
      label={props.modeLabel ?? t('modes.real')}
      size="small"
      variant="outlined"
      aria-label={t('modes.source', { mode: props.modeLabel ?? t('modes.real') })}
    />
  );
  return (
    <Box sx={{ display: 'flex', zIndex: 1, position: 'relative' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${String(drawerWidth)}px)` },
          ml: { md: `${String(drawerWidth)}px` },
          borderBottom: 1,
          borderColor: 'divider',
          [`&.${paperClasses.root}`]: { outline: 'none' },
          transition: theme.transitions.create('width', {
            duration: theme.transitions.duration.standard,
          }),
        }}
      >
        <Toolbar variant="appbar" sx={{ px: { xs: 1.5, sm: 3, md: 5 } }}>
          {mobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: { xs: 1, sm: 2 } }}>
              <Button
                color="neutral"
                variant="soft"
                shape="circle"
                aria-label={t('navigation.open')}
                aria-expanded={mobileOpen}
                onClick={() => {
                  setMobileOpen(true);
                }}
              >
                <IconifyIcon icon="material-symbols:menu-rounded" sx={{ fontSize: 20 }} />
              </Button>
              <Logo showName={showName} />
            </Box>
          )}
          <Stack
            direction="row"
            sx={{ alignItems: 'center', flex: 1, minWidth: 0, gap: { xs: 0.5, md: 2 } }}
          >
            {!mobile && (
              <>
                <IconButton
                  aria-label={collapsed ? t('navigation.expand') : t('navigation.collapse')}
                  aria-expanded={!collapsed}
                  onClick={toggleCollapsed}
                >
                  <IconifyIcon
                    icon={
                      collapsed
                        ? 'material-symbols:left-panel-open-outline'
                        : 'material-symbols:left-panel-close-outline'
                    }
                  />
                </IconButton>
                {modeIndicator}
              </>
            )}
            <SearchBox mobile={mobile} groups={groups} onNavigate={navigate} />
            {!mobile && <StoreSelector {...props} />}
            <Stack
              className="action-items"
              direction="row"
              sx={{ gap: { xs: 0.5, sm: 1 }, alignItems: 'center', ml: 'auto' }}
            >
              <LanguageMenu language={props.language} onChange={props.onLanguageChange} />
              <ThemeMenu />
              <NotificationMenu />
              <ProfileMenu />
            </Stack>
          </Stack>
        </Toolbar>
      </AppBar>
      <Sidenav
        groups={groups}
        section={selectedSection}
        collapsed={collapsed}
        tablet={!mobile && !wide}
        width={drawerWidth}
        onToggle={toggleCollapsed}
        onNavigate={navigate}
      />
      <Drawer
        variant="temporary"
        open={mobileOpen}
        ModalProps={{ disableScrollLock: false }}
        onClose={() => {
          setMobileOpen(false);
        }}
        slotProps={{ paper: { role: 'dialog', 'aria-label': t('navigation.label') } }}
        sx={{
          display: { xs: 'block', md: 'none' },
          [`& .${drawerClasses.paper}`]: { pt: 3, boxSizing: 'border-box', width: 300 },
        }}
      >
        <SidenavContent
          groups={groups}
          section={selectedSection}
          onClose={() => {
            setMobileOpen(false);
          }}
          onNavigate={navigate}
        />
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 0,
          minWidth: 0,
          minHeight: '100vh',
          width: { xs: '100%', md: `calc(100% - ${String(drawerWidth)}px)` },
          display: 'flex',
          flexDirection: 'column',
          ml: { md: '72px', lg: 0 },
        }}
      >
        <Toolbar variant="appbar" />
        {mobile && (
          <Stack
            direction="row"
            sx={{
              px: 3,
              py: 1.5,
              gap: 2,
              alignItems: 'center',
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.default',
            }}
          >
            {modeIndicator}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <StoreSelector {...props} />
            </Box>
          </Stack>
        )}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.default',
          }}
        >
          {props.controls}
          {children}
        </Box>
      </Box>
    </Box>
  );
}
