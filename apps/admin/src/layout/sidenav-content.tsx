// Aurora SidenavDrawerContent shared by the Default sidenav and mobile drawer.
import { Box, IconButton, List, ListSubheader, Toolbar } from '@mui/material';
import IconifyIcon from './primitives/iconify-icon.js';
import Logo from './primitives/logo.js';
import SimpleBar from './primitives/simplebar.js';
import NavItem from './nav-item.js';
import type { NavigationGroup } from './types.js';
export default function SidenavContent({
  groups,
  section,
  collapsed = false,
  onClose,
  onNavigate,
}: {
  groups: readonly NavigationGroup[];
  section: string;
  collapsed?: boolean;
  onClose?: () => void;
  onNavigate: (section: string) => void;
}) {
  return (
    <>
      <Toolbar variant="appbar" sx={{ display: 'block', px: { xs: 0 } }}>
        <Box
          sx={{
            height: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            pl: collapsed ? 0 : { xs: 4, md: 6 },
            pr: collapsed ? 0 : { xs: 2, md: 3 },
          }}
        >
          <Logo showName={!collapsed} />
          {onClose && (
            <IconButton aria-label="Close navigation" sx={{ mt: 1 }} onClick={onClose}>
              <IconifyIcon icon="material-symbols:left-panel-close-outline" fontSize={20} />
            </IconButton>
          )}
        </Box>
      </Toolbar>
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <SimpleBar
          disableHorizontal
          sx={{ '& .simplebar-vertical .simplebar-scrollbar:before': { bgcolor: 'chGrey.300' } }}
        >
          <Box sx={{ py: 2, px: collapsed ? 2 : { xs: 2, md: 4 } }}>
            {groups.map((group, index) => (
              <List
                key={group.key}
                dense
                role="menu"
                aria-label={group.label}
                sx={{
                  mb: index !== groups.length - 1 ? 3 : 0,
                  pb: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
                subheader={
                  <ListSubheader
                    component="div"
                    disableGutters
                    sx={{
                      textAlign: collapsed ? 'center' : 'left',
                      color: 'text.disabled',
                      typography: 'overline',
                      fontWeight: 700,
                      py: 1,
                      pl: collapsed ? 0 : 2,
                      mb: 0.25,
                      position: 'static',
                      background: 'transparent',
                    }}
                  >
                    {group.label}
                  </ListSubheader>
                }
              >
                {group.items.map((item) => (
                  <NavItem
                    key={item.key}
                    item={item}
                    section={section}
                    collapsed={collapsed}
                    onNavigate={(next) => {
                      onClose?.();
                      onNavigate(next);
                    }}
                  />
                ))}
              </List>
            ))}
          </Box>
        </SimpleBar>
      </Box>
    </>
  );
}
