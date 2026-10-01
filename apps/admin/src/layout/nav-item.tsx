// Adapted from Aurora NavItem for Default sidenav items and the mobile drawer.
import { useState } from 'react';
import {
  Box,
  Collapse,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  listItemTextClasses,
} from '@mui/material';
import IconifyIcon from './primitives/iconify-icon.js';
import { containsSection, type NavigationItem } from './types.js';

type Props = {
  item: NavigationItem;
  section: string;
  onNavigate: (section: string) => void;
  collapsed?: boolean;
  level?: number;
};
export default function NavItem({
  item,
  section,
  onNavigate,
  collapsed = false,
  level = 0,
}: Props) {
  const compact = collapsed && level === 0;
  const activeChild = item.children ? containsSection(item.children, section) : false;
  const [expanded, setExpanded] = useState(activeChild);
  const [lastSection, setLastSection] = useState(section);
  if (lastSection !== section) {
    setLastSection(section);
    setExpanded(activeChild);
  }
  return (
    <>
      <ListItem disablePadding>
        <ListItemButton
          component="button"
          role="menuitem"
          aria-current={item.key === section ? 'page' : undefined}
          aria-expanded={item.children ? expanded : undefined}
          onClick={() => {
            if (item.children) setExpanded(!expanded);
            else onNavigate(item.key);
          }}
          selected={item.key === section || (!expanded && activeChild)}
          sx={(theme) => ({
            p: compact ? 1 : theme.spacing('3.5px', 2),
            width: 1,
            minWidth: compact ? 0 : 180,
            flexDirection: compact ? 'column' : 'row',
            justifyContent: 'flex-start',
            alignItems: 'center',
            textAlign: compact ? 'center' : 'left',
            '&.Mui-selected': { [`& .${listItemTextClasses.primary}`]: { color: 'primary.main' } },
          })}
        >
          <ListItemIcon>
            <IconifyIcon icon={item.icon} sx={{ fontSize: compact ? 24 : 14 }} />
          </ListItemIcon>
          <Box
            sx={{
              flex: 1,
              width: 1,
              px: compact ? 1 : 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <ListItemText
              sx={{
                [`& .${listItemTextClasses.primary}`]: {
                  typography: 'caption',
                  fontWeight: 'medium',
                  lineHeight: 1.3,
                  color: level === 0 ? 'text.primary' : 'text.secondary',
                  whiteSpace: compact ? 'normal' : 'nowrap',
                  ...(compact && { lineClamp: 1, wordBreak: 'break-all' }),
                },
              }}
            >
              {item.label}
            </ListItemText>
            {item.children && (
              <IconifyIcon
                icon="material-symbols:expand-more-rounded"
                sx={{
                  fontSize: 12,
                  transform: expanded ? 'rotate(180deg)' : 'none',
                  transition: (theme) =>
                    theme.transitions.create('transform', {
                      duration: theme.transitions.duration.shorter,
                    }),
                }}
              />
            )}
          </Box>
        </ListItemButton>
      </ListItem>
      {item.children && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <List
            dense
            disablePadding
            role="menu"
            aria-label={item.label}
            sx={{ pl: level === 0 ? 4 : 2, display: 'flex', flexDirection: 'column', gap: '2px' }}
          >
            {item.children.map((child) => (
              <NavItem
                key={child.key}
                item={child}
                section={section}
                onNavigate={onNavigate}
                collapsed={collapsed}
                level={level + 1}
              />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
}
