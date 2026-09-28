// Aurora SearchBox, SearchPopover/Dialog and result rows, using local navigation examples.
import { useRef, useState } from 'react';
import {
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Dialog,
  Divider,
  Fade,
  IconButton,
  InputAdornment,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  Stack,
  Typography,
  dialogClasses,
  inputBaseClasses,
} from '@mui/material';
import SimpleBarReact from 'simplebar-react';
import IconifyIcon from './primitives/iconify-icon.js';
import StyledTextField from './primitives/styled-text-field.js';
import type { NavigationGroup, NavigationItem } from './types.js';

function flatten(items: readonly NavigationItem[]): NavigationItem[] {
  return items.flatMap((item) => (item.children ? flatten(item.children) : [item]));
}
export default function SearchBox({
  mobile,
  groups,
  onNavigate,
}: {
  mobile: boolean;
  groups: readonly NavigationGroup[];
  onNavigate: (section: string) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const searchInput = useRef<HTMLInputElement>(null);
  const entries = groups.flatMap((group) => flatten(group.items));
  const filtered = entries.filter((entry) =>
    entry.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const close = () => {
    setAnchor(null);
  };
  const open = (element: HTMLElement) => {
    setQuery('');
    setAnchor(element);
  };
  const select = (entry: NavigationItem) => {
    close();
    setRecent((current) => [entry.key, ...current.filter((key) => key !== entry.key)].slice(0, 3));
    onNavigate(entry.key);
  };
  const content = (
    <>
      <StyledTextField
        autoFocus
        inputRef={searchInput}
        fullWidth
        placeholder="Search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
        slotProps={{
          htmlInput: { 'aria-label': 'Search workspace' },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <IconifyIcon icon="material-symbols:search-rounded" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" edge="end" aria-label="Close search" onClick={close}>
                  <IconifyIcon icon="material-symbols:close-rounded" color="grey.500" />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
        sx={{
          [`& .${inputBaseClasses.root}`]: {
            borderRadius: '4px 4px 0 0',
            border: 1,
            borderColor: 'transparent',
            [`&.${inputBaseClasses.focused}`]: {
              outline: 'none',
              border: 1,
              borderTopLeftRadius: 8,
              borderTopRightRadius: 8,
              borderColor: 'primary.main',
              boxShadow: 'none',
            },
          },
        }}
      />
      <SimpleBarReact style={{ maxHeight: 600, minHeight: 0, width: '100%' }}>
        <Box sx={{ px: 3, py: 1.25 }}>
          <Typography variant="caption" color="text.secondary">
            Search navigation and local examples
          </Typography>
        </Box>
        <Divider />
        {!query && recent.length > 0 && (
          <>
            <Stack direction="row" sx={{ justifyContent: 'space-between', py: 2, px: 3 }}>
              <Typography variant="caption" sx={{ fontWeight: 'medium', color: 'text.disabled' }}>
                Recent
              </Typography>
              <Link
                component="button"
                variant="caption"
                underline="none"
                onClick={() => {
                  setRecent([]);
                }}
                sx={{ fontWeight: 'medium' }}
              >
                Clear history
              </Link>
            </Stack>
            <List
              dense
              sx={{
                pt: 0,
                pb: 2,
                listStyleType: 'disc',
                listStylePosition: 'inside',
                color: 'grey.300',
              }}
            >
              {recent.map((key) => {
                const entry = entries.find((item) => item.key === key);
                return (
                  entry && (
                    <ListItem
                      key={key}
                      sx={{
                        px: 3,
                        display: 'list-item',
                        '&:hover': { bgcolor: 'background.menuElevation1' },
                      }}
                    >
                      <Breadcrumbs
                        sx={{
                          py: 0.5,
                          typography: 'caption',
                          color: 'text.secondary',
                          ml: -0.5,
                          display: 'inline-block',
                          fontWeight: 'medium',
                        }}
                      >
                        <Typography variant="caption">Workspace</Typography>
                        <Link
                          component="button"
                          underline="none"
                          onClick={() => {
                            select(entry);
                          }}
                        >
                          {entry.label}
                        </Link>
                      </Breadcrumbs>
                    </ListItem>
                  )
                );
              })}
            </List>
            <Divider />
          </>
        )}
        <Box sx={{ my: 2, px: 3 }}>
          <Typography
            variant="caption"
            component="h6"
            sx={{ fontWeight: 'medium', color: 'text.disabled' }}
          >
            Modules
          </Typography>
        </Box>
        <List sx={{ pt: 0, pb: 2 }}>
          {filtered.map((entry) => (
            <ListItem disablePadding key={entry.key}>
              <ListItemButton
                onClick={() => {
                  select(entry);
                }}
                sx={(theme) => ({
                  gap: 1,
                  py: 1,
                  pl: 3,
                  pr: `${theme.spacing(8)} !important`,
                  borderRadius: 0,
                  '&:hover': { bgcolor: 'background.menuElevation1' },
                })}
              >
                <ListItemIcon>
                  <IconifyIcon icon={entry.icon} fontSize={32} color="primary.main" />
                </ListItemIcon>
                <ListItemText
                  primary={entry.label}
                  secondary={`Workspace / ${entry.label}`}
                  sx={{ my: 0 }}
                  slotProps={{
                    primary: {
                      variant: 'subtitle2',
                      color: 'text.secondary',
                      sx: { mb: 0.25, display: 'flex', lineClamp: 1 },
                    },
                    secondary: {
                      variant: 'caption',
                      color: 'text.disabled',
                      component: 'p',
                      sx: { fontWeight: 'medium' },
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        {filtered.length === 0 && (
          <Typography variant="body2" sx={{ px: 3, pb: 2 }} color="text.secondary">
            {entries.length ? 'No matching results.' : 'Select a store to search its navigation.'}
          </Typography>
        )}
        <Divider />
        <Box sx={{ my: 2, px: 3 }}>
          <Typography
            variant="caption"
            component="h6"
            sx={{ fontWeight: 'medium', color: 'text.disabled' }}
          >
            Popular tags
          </Typography>
        </Box>
        <Stack direction="row" sx={{ px: 3, mb: 2, gap: 1, flexWrap: 'wrap' }}>
          {entries.slice(0, 5).map((entry) => (
            <Chip
              key={entry.key}
              label={entry.label}
              variant="soft"
              color="neutral"
              onClick={() => {
                setQuery(entry.label);
              }}
            />
          ))}
        </Stack>
        <Box sx={{ px: 3, py: 2 }}>
          <Typography variant="caption" color="text.disabled">
            Example search · Business records are not searched yet.
          </Typography>
        </Box>
      </SimpleBarReact>
    </>
  );
  return (
    <>
      {mobile ? (
        <Button
          className="search-box-button"
          color="neutral"
          shape="circle"
          variant="soft"
          aria-label="Search"
          onClick={(event) => {
            open(event.currentTarget);
          }}
        >
          <IconifyIcon icon="material-symbols:search-rounded" sx={{ fontSize: 20 }} />
        </Button>
      ) : (
        <StyledTextField
          placeholder="Search"
          focused={false}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'ArrowDown' || event.key === ' ') {
              event.preventDefault();
              open(event.currentTarget);
            }
          }}
          slotProps={{
            htmlInput: {
              'aria-label': 'Search',
              readOnly: true,
            },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <IconifyIcon icon="material-symbols:search-rounded" />
                </InputAdornment>
              ),
              onClick: (event) => {
                open(event.currentTarget);
              },
              sx: { borderRadius: 5, border: 1, borderStyle: 'solid', borderColor: 'transparent' },
            },
          }}
          sx={{ width: 1, maxWidth: 420, minWidth: 0 }}
        />
      )}
      {mobile ? (
        <Dialog
          open={Boolean(anchor)}
          onClose={close}
          maxWidth="sm"
          slotProps={{
            paper: { 'aria-label': 'Search workspace' },
            transition: { onEntered: () => searchInput.current?.focus() },
          }}
          sx={{
            [`& .${dialogClasses.paper}`]: {
              bgcolor: 'background.menu',
              width: '100%',
              borderRadius: 2,
              outline: 'none',
              overflow: 'hidden',
            },
          }}
        >
          {content}
        </Dialog>
      ) : (
        <Popover
          open={Boolean(anchor)}
          anchorEl={anchor}
          onClose={close}
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
          marginThreshold={0}
          elevation={3}
          transitionDuration={150}
          slots={{ transition: Fade }}
          slotProps={{
            transition: { onEntered: () => searchInput.current?.focus() },
            paper: {
              role: 'dialog',
              'aria-label': 'Search workspace',
              sx: {
                width: 1,
                maxWidth: 420,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                borderWidth: '0 !important',
                boxShadow: (theme) => `0 0 0 1px ${theme.vars.palette.menuDivider}`,
              },
            },
            root: { slotProps: { backdrop: { invisible: false } } },
          }}
        >
          {content}
        </Popover>
      )}
    </>
  );
}
