import { useTranslation } from 'react-i18next';
// Aurora SidenavDrawerContent shared by the permanent and temporary drawers.
import { Box, IconButton, List, ListSubheader, Toolbar } from '@mui/material';
import IconifyIcon from './primitives/iconify-icon.js';
import Logo from './primitives/logo.js';
import SimpleBar from './primitives/simplebar.js';
import NavItem from './nav-item.js';
import type { NavigationGroup } from './types.js';
export default function SidenavContent({
  groups,
  section,
  onClose,
  onNavigate,
  collapsed = false,
}: {
  groups: readonly NavigationGroup[];
  section: string;
  onClose?: () => void;
  onNavigate: (section: string) => void;
  collapsed?: boolean;
}) {
  const { t } = useTranslation('shell');
  return (
    <>
      <Toolbar variant="appbar" sx={{ display: 'block', px: { xs: 0 } }}>
        <Box
          sx={{
            height: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            px: collapsed ? 0 : 4,
          }}
        >
          <Logo showName={!collapsed} />
          {onClose && (
            <IconButton aria-label={t('navigation.close')} sx={{ mt: 1 }} onClick={onClose}>
              <IconifyIcon icon="material-symbols:left-panel-close-outline" fontSize={20} />
            </IconButton>
          )}
        </Box>
      </Toolbar>
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <SimpleBar disableHorizontal>
          <Box sx={{ py: 2, px: collapsed ? 2 : 4 }}>
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
                  !collapsed && (
                    <ListSubheader
                      component="div"
                      disableGutters
                      sx={{
                        textAlign: 'left',
                        color: 'text.disabled',
                        typography: 'overline',
                        fontWeight: 700,
                        py: 1,
                        pl: 2,
                        mb: 0.25,
                        position: 'static',
                        background: 'transparent',
                      }}
                    >
                      {group.label}
                    </ListSubheader>
                  )
                }
              >
                {group.items.map((item) => (
                  <NavItem
                    key={item.key}
                    item={item}
                    section={section}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
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
