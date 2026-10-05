import { useTranslation } from 'react-i18next';
// Aurora SearchBox, SearchPopover/Dialog and result rows, using local navigation examples.
import { useEffect, useRef, useState } from 'react';
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
  type PopoverActions,
  dialogClasses,
  inputBaseClasses,
} from '@mui/material';
import SimpleBarReact from 'simplebar-react';
import IconifyIcon from './primitives/iconify-icon.js';
import StyledTextField from './primitives/styled-text-field.js';
import type { NavigationGroup, NavigationItem } from './types.js';

export default function SearchBox({
  mobile,
  groups,
  onNavigate,
}: {
  mobile: boolean;
  groups: readonly NavigationGroup[];
  onNavigate: (section: string) => void;
}) {
  const { t } = useTranslation('shell');
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const searchInput = useRef<HTMLInputElement>(null);
  const desktopTrigger = useRef<HTMLDivElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<PopoverActions>(null);
  useEffect(() => {
    if (!isOpen || mobile || !desktopTrigger.current) return;
    // The top bar animates its width after changing navigation breakpoints.
    const observer = new ResizeObserver(() => popover.current?.updatePosition());
    observer.observe(desktopTrigger.current.parentElement ?? desktopTrigger.current);
    return () => {
      observer.disconnect();
    };
  }, [isOpen, mobile]);
  const entries = groups.flatMap((group) => group.items);
  const filtered = entries.filter((entry) =>
    entry.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const close = () => {
    setIsOpen(false);
  };
  const open = () => {
    setQuery('');
    setIsOpen(true);
  };
  const restoreFocus = () => {
    // A breakpoint change removes the trigger remembered by MUI's focus trap.
    if (
      document.activeElement === document.body ||
      searchInput.current?.closest('[role="dialog"]')?.contains(document.activeElement)
    ) {
      if (mobile) mobileTrigger.current?.focus();
      else desktopTrigger.current?.querySelector<HTMLInputElement>('input')?.focus();
    }
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
        placeholder={t('search.label')}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
        slotProps={{
          htmlInput: { 'aria-label': t('search.workspace') },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <IconifyIcon icon="material-symbols:search-rounded" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" edge="end" aria-label={t('search.close')} onClick={close}>
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
            {t('search.description')}
          </Typography>
        </Box>
        <Divider />
        {!query && recent.length > 0 && (
          <>
            <Stack direction="row" sx={{ justifyContent: 'space-between', py: 2, px: 3 }}>
              <Typography variant="caption" sx={{ fontWeight: 'medium', color: 'text.disabled' }}>
                {t('search.recent')}
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
                {t('search.clearHistory')}
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
                        <Typography variant="caption">{t('navigation.workspace')}</Typography>
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
            {t('search.modules')}
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
                  secondary={t('search.path', { module: entry.label })}
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
            {entries.length ? t('search.noMatches') : t('search.selectStore')}
          </Typography>
        )}
        <Divider />
        <Box sx={{ my: 2, px: 3 }}>
          <Typography
            variant="caption"
            component="h6"
            sx={{ fontWeight: 'medium', color: 'text.disabled' }}
          >
            {t('search.popularTags')}
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
            {t('search.exampleHint')}
          </Typography>
        </Box>
      </SimpleBarReact>
    </>
  );
  return (
    <>
      {mobile ? (
        <Button
          ref={mobileTrigger}
          className="search-box-button"
          color="neutral"
          shape="circle"
          variant="soft"
          aria-label={t('search.label')}
          onClick={open}
        >
          <IconifyIcon icon="material-symbols:search-rounded" sx={{ fontSize: 20 }} />
        </Button>
      ) : (
        <StyledTextField
          ref={desktopTrigger}
          placeholder={t('search.label')}
          focused={false}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'ArrowDown' || event.key === ' ') {
              event.preventDefault();
              open();
            }
          }}
          slotProps={{
            htmlInput: {
              'aria-label': t('search.label'),
              readOnly: true,
            },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <IconifyIcon icon="material-symbols:search-rounded" />
                </InputAdornment>
              ),
              onClick: open,
              sx: { borderRadius: 5, border: 1, borderStyle: 'solid', borderColor: 'transparent' },
            },
          }}
          sx={{ width: 1, maxWidth: 420, minWidth: 0 }}
        />
      )}
      {mobile ? (
        <Dialog
          open={isOpen}
          onClose={close}
          maxWidth="sm"
          slotProps={{
            paper: { 'aria-label': t('search.workspace') },
            transition: { onEntered: () => searchInput.current?.focus(), onExited: restoreFocus },
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
          action={popover}
          open={isOpen}
          anchorEl={() => desktopTrigger.current}
          onClose={close}
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
          marginThreshold={0}
          elevation={3}
          transitionDuration={150}
          slots={{ transition: Fade }}
          slotProps={{
            transition: { onEntered: () => searchInput.current?.focus(), onExited: restoreFocus },
            paper: {
              role: 'dialog',
              'aria-label': t('search.workspace'),
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
