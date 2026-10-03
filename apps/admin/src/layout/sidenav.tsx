// Adapted from Aurora's default Sidenav; application inputs replace its demo providers.
import { Backdrop, Box, Drawer, drawerClasses } from '@mui/material';
import SidenavContent from './sidenav-content.js';
import type { NavigationGroup } from './types.js';

export default function Sidenav({
  groups,
  section,
  collapsed,
  tablet,
  width,
  onToggle,
  onNavigate,
}: {
  groups: readonly NavigationGroup[];
  section: string;
  collapsed: boolean;
  tablet: boolean;
  width: number;
  onToggle: () => void;
  onNavigate: (section: string) => void;
}) {
  return (
    <Box
      component="nav"
      aria-label="Workspace navigation"
      className="default-sidenav"
      sx={{
        width: { md: width },
        flexShrink: { sm: 0 },
        position: { md: 'absolute', lg: 'relative' },
        transition: (theme) => theme.transitions.create('width'),
      }}
    >
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'flex' },
          [`& .${drawerClasses.paper}`]: {
            boxSizing: 'border-box',
            width,
            transition: (theme) => theme.transitions.create('width'),
          },
        }}
      >
        <SidenavContent
          groups={groups}
          section={section}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      </Drawer>
      <Backdrop open={tablet && !collapsed} sx={{ zIndex: 1199 }} onClick={onToggle} />
    </Box>
  );
}
