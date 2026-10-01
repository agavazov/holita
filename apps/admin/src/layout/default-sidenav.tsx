// Adapted from Aurora sidenav/index.tsx and SidenavCollapse.tsx.
import { useRef } from 'react';
import { Backdrop, Box, ButtonBase, Drawer, Tooltip, drawerClasses } from '@mui/material';
import SidenavContent from './sidenav-content.js';
import type { NavigationGroup } from './types.js';

type Props = {
  groups: readonly NavigationGroup[];
  section: string;
  collapsed: boolean;
  tablet: boolean;
  width: number;
  onToggle: () => void;
  onNavigate: (section: string) => void;
};

export default function DefaultSidenav({
  groups,
  section,
  collapsed,
  tablet,
  width,
  onToggle,
  onNavigate,
}: Props) {
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <Box
      component="nav"
      aria-label="Workspace navigation"
      className="default-sidenav"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && tablet && !collapsed) {
          onToggle();
          toggle.current?.focus();
        }
      }}
      sx={{
        width: { md: width },
        flexShrink: { sm: 0 },
        position: { md: 'absolute', lg: 'relative' },
        transition: (theme) => ({
          xs: theme.transitions.create('width', { duration: theme.transitions.duration.standard }),
          lg: 'none',
        }),
      }}
    >
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          [`& .${drawerClasses.paper}`]: {
            overflow: 'visible',
            boxSizing: 'border-box',
            width,
            border: 0,
            borderRight: 1,
            borderColor: 'divider',
            transition: (theme) => ({
              xs: theme.transitions.create('width', {
                duration: theme.transitions.duration.standard,
              }),
              lg: 'none',
            }),
          },
        }}
      >
        <SidenavContent
          groups={groups}
          section={section}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        <Tooltip title={collapsed ? 'Expand' : 'Collapse'} placement="right" disableInteractive>
          <ButtonBase
            ref={toggle}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-expanded={!collapsed}
            onClick={onToggle}
            disableRipple
            sx={{
              width: 40,
              flexShrink: 0,
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              right: -30,
              height: 80,
              borderRadius: 0,
              textAlign: 'center',
              p: '0px !important',
              '& path': { transition: 'opacity 150ms ease' },
              '& .collapse-chevron': { opacity: 0 },
              '&:hover, &.Mui-focusVisible': {
                '& .collapse-line': { opacity: 0 },
                '& .collapse-chevron': { opacity: 1 },
              },
              '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main' },
              '@media (prefers-reduced-motion: reduce)': { '& path': { transition: 'none' } },
            }}
          >
            <Box
              component="svg"
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              sx={{
                width: 24,
                height: 24,
                stroke: (theme) => theme.vars.palette.background.elevation4,
              }}
            >
              <path className="collapse-line" d="M8 4v16" />
              <path
                className="collapse-chevron"
                d={collapsed ? 'M8 6l6 6-6 6' : 'M14 6l-6 6 6 6'}
              />
            </Box>
          </ButtonBase>
        </Tooltip>
      </Drawer>
      {tablet && (
        <Backdrop
          open={!collapsed}
          sx={{ zIndex: 1199 }}
          onClick={() => {
            onToggle();
            toggle.current?.focus();
          }}
        />
      )}
    </Box>
  );
}
