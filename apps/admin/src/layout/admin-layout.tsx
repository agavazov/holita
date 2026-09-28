// Aurora MainLayout and AppBar, restricted to Sidenav / Stacked.
import { useEffect, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
  drawerClasses,
  paperClasses,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { version } from '../../package.json';
import IconifyIcon from './primitives/iconify-icon.js';
import Logo from './primitives/logo.js';
import StyledTextField from './primitives/styled-text-field.js';
import StackedSidenav from './stacked-sidenav.js';
import MobileNavigation from './mobile-navigation.js';
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
  return (
    <StyledTextField
      select
      id="store-switcher"
      label="Store"
      size="small"
      value={selectedStoreId ?? ''}
      onChange={(event) => {
        onStoreChange(event.target.value);
      }}
      slotProps={{
        select: {
          displayEmpty: true,
          inputProps: { 'aria-label': 'Store', 'aria-busy': storesLoading },
        },
      }}
      sx={{ width: { xs: '100%', md: 184 }, flexShrink: 0 }}
    >
      <MenuItem value="" disabled>
        {storesLoading ? 'Loading stores…' : 'Select a store'}
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
  const drawerWidth = mobile ? 0 : collapsed ? 72 : 300;
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
                aria-label="Open navigation"
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
            <SearchBox mobile={mobile} groups={groups} onNavigate={navigate} />
            {!mobile && <StoreSelector {...props} />}
            <Stack
              className="action-items"
              direction="row"
              sx={{ gap: { xs: 0.5, sm: 1 }, alignItems: 'center', ml: 'auto' }}
            >
              <LanguageMenu />
              <ThemeMenu />
              <NotificationMenu />
              <ProfileMenu />
            </Stack>
          </Stack>
        </Toolbar>
      </AppBar>
      <StackedSidenav
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
        slotProps={{ paper: { role: 'dialog', 'aria-label': 'Navigation' } }}
        sx={{
          display: { xs: 'block', md: 'none' },
          [`& .${drawerClasses.paper}`]: { pt: 3, boxSizing: 'border-box', width: 300 },
        }}
      >
        <MobileNavigation
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
          <Box
            sx={{
              px: 3,
              py: 1.5,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.default',
            }}
          >
            <StoreSelector {...props} />
          </Box>
        )}
        <Box sx={{ flex: 1, display: 'flex', bgcolor: 'background.default' }}>
          <Box className="legacy-content">{children}</Box>
        </Box>
        <Divider />
        <Stack
          direction={{ sm: 'row' }}
          sx={{
            columnGap: 2,
            rowGap: 0.5,
            bgcolor: 'background.default',
            justifyContent: { xs: 'center', sm: 'space-between' },
            alignItems: 'center',
            height: ({ mixins }) => mixins.footer,
            py: 1,
            px: { xs: 3, md: 5 },
            textAlign: { xs: 'center', sm: 'left' },
          }}
        >
          <Typography
            variant="caption"
            component="p"
            sx={{ lineHeight: 1.6, fontWeight: 'light', color: 'text.secondary' }}
          >
            holita · {new Date().getFullYear()}
          </Typography>
          <Typography
            variant="caption"
            component="p"
            sx={{ fontWeight: 'light', color: 'text.secondary' }}
          >
            v{version}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
