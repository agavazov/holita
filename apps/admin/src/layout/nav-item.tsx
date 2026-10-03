// Aurora NavItem presentation for the application's flat module navigation.
import {
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  listItemTextClasses,
} from '@mui/material';
import IconifyIcon from './primitives/iconify-icon.js';
import type { NavigationItem } from './types.js';

export default function NavItem({
  item,
  section,
  onNavigate,
  collapsed = false,
}: {
  item: NavigationItem;
  section: string;
  onNavigate: (section: string) => void;
  collapsed?: boolean;
}) {
  const selected = item.key === section;
  return (
    <ListItem disablePadding sx={{ mb: 0.25 }}>
      <Tooltip title={collapsed ? item.label : ''} placement="right">
        <ListItemButton
          component="button"
          role="menuitem"
          aria-label={item.label}
          aria-current={selected ? 'page' : undefined}
          onClick={() => {
            onNavigate(item.key);
          }}
          selected={selected}
          sx={(theme) => ({
            p: collapsed ? theme.spacing(1.5) : theme.spacing('3.5px', 2),
            justifyContent: collapsed ? 'center' : 'flex-start',
            width: 1,
            textAlign: 'left',
            '&.Mui-selected': {
              [`& .${listItemTextClasses.primary}`]: { color: 'primary.main' },
            },
          })}
        >
          <ListItemIcon
            sx={{
              minWidth: collapsed ? 0 : undefined,
              color: selected ? 'primary.main' : 'text.secondary',
            }}
          >
            <IconifyIcon icon={item.icon} sx={{ fontSize: collapsed ? 24 : 14 }} />
          </ListItemIcon>
          {!collapsed && (
            <ListItemText
              sx={{
                [`& .${listItemTextClasses.primary}`]: {
                  typography: 'caption',
                  fontWeight: 'medium',
                  lineHeight: 1.3,
                  color: 'text.primary',
                  whiteSpace: 'nowrap',
                },
              }}
            >
              {item.label}
            </ListItemText>
          )}
        </ListItemButton>
      </Tooltip>
    </ListItem>
  );
}
