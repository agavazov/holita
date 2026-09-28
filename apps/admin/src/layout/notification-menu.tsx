// Aurora NotificationMenu/NotificationList presentation with local read/remove actions.
import { useState } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListSubheader,
  Menu,
  MenuItem,
  Popover,
  Stack,
  Typography,
  badgeClasses,
  paperClasses,
} from '@mui/material';
import IconifyIcon from './primitives/iconify-icon.js';
import SimpleBar from './primitives/simplebar.js';
import OutlinedBadge from './primitives/outlined-badge.js';
import { exampleNotifications, type ExampleNotification } from './demo-data.js';

function NotificationActions({
  notification,
  onRead,
  onRemove,
}: {
  notification: ExampleNotification;
  onRead: () => void;
  onRemove: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button
        shape="square"
        color="neutral"
        variant="text"
        aria-label={`Actions for ${notification.detail}`}
        onClick={(event) => {
          setAnchor(event.currentTarget);
        }}
      >
        <IconifyIcon icon="material-symbols:more-horiz" />
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => {
          setAnchor(null);
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onRead();
          }}
        >
          {notification.read ? 'Mark as unread' : 'Mark as read'}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onRemove();
          }}
          sx={{ color: 'error.main' }}
        >
          Remove notification
        </MenuItem>
      </Menu>
    </>
  );
}
export default function NotificationMenu() {
  const [notifications, setNotifications] = useState(() => [...exampleNotifications]);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const unread = notifications.some((notification) => !notification.read);
  const toggleRead = (id: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, read: !notification.read } : notification,
      ),
    );
  };
  return (
    <>
      <Button
        color="neutral"
        variant="soft"
        shape="circle"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => {
          setAnchor(event.currentTarget);
        }}
      >
        <OutlinedBadge
          variant="dot"
          color="error"
          invisible={!unread}
          sx={{
            [`& .${badgeClasses.badge}`]: {
              height: 10,
              width: 10,
              top: -2,
              right: -2,
              borderRadius: '50%',
            },
          }}
        >
          <IconifyIcon
            icon="material-symbols-light:notifications-outline-rounded"
            sx={{ fontSize: 22 }}
          />
        </OutlinedBadge>
      </Button>
      <Popover
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => {
          setAnchor(null);
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{ paper: { role: 'dialog', 'aria-label': 'Example notifications' } }}
        sx={{
          [`& .${paperClasses.root}`]: {
            width: 400,
            height: 650,
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box sx={{ pt: 2, flex: 1, overflow: 'hidden' }}>
          <SimpleBar disableHorizontal>
            <Typography
              variant="caption"
              sx={{ display: 'block', color: 'text.disabled', px: 2, pb: 1 }}
            >
              Example notifications
            </Typography>
            {(['today', 'older'] as const).map((group) => {
              const items = notifications.filter((notification) => notification.group === group);
              return (
                items.length > 0 && (
                  <List
                    key={group}
                    subheader={
                      <ListSubheader
                        component="div"
                        sx={{
                          typography: 'body2',
                          fontWeight: 'bold',
                          color: 'text.primary',
                          lineHeight: 1.45,
                          mb: 0.5,
                          position: 'static',
                          bgcolor: 'transparent',
                        }}
                      >
                        {group === 'today' ? 'Today' : 'Older'}
                      </ListSubheader>
                    }
                  >
                    {items.map((notification) => (
                      <ListItem
                        key={notification.id}
                        disablePadding
                        secondaryAction={
                          <NotificationActions
                            notification={notification}
                            onRead={() => {
                              toggleRead(notification.id);
                            }}
                            onRemove={() => {
                              setNotifications((current) =>
                                current.filter((item) => item.id !== notification.id),
                              );
                            }}
                          />
                        }
                        sx={{
                          '& .MuiListItemSecondaryAction-root': { top: 16, transform: 'none' },
                        }}
                      >
                        <ListItemButton
                          onClick={() => {
                            toggleRead(notification.id);
                          }}
                          aria-label={`${notification.read ? 'Mark unread' : 'Mark read'}: ${notification.detail}`}
                          disableRipple
                          sx={{
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            borderRadius: 0,
                            p: 2,
                            pr: 6,
                            gap: 1,
                            '&:hover': { bgcolor: 'background.menuElevation1' },
                          }}
                        >
                          <Stack
                            direction="row"
                            sx={{ alignItems: 'flex-start', gap: 1, width: 1 }}
                          >
                            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
                              <Box sx={{ width: 8, height: 1 }}>
                                {!notification.read && (
                                  <Box
                                    component="span"
                                    sx={{
                                      display: 'block',
                                      height: 8,
                                      width: 8,
                                      bgcolor: 'error.main',
                                      outline: 2,
                                      outlineColor: 'background.paper',
                                      borderRadius: '50%',
                                    }}
                                  />
                                )}
                              </Box>
                              <Badge
                                overlap="circular"
                                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                badgeContent={
                                  <Avatar sx={{ height: 16, width: 16, bgcolor: 'primary.main' }}>
                                    <IconifyIcon
                                      icon="material-symbols:chat-outline-rounded"
                                      sx={{ fontSize: 10 }}
                                    />
                                  </Avatar>
                                }
                                sx={{
                                  [`& .${badgeClasses.badge}`]: {
                                    height: 16,
                                    width: 16,
                                    minWidth: 'auto',
                                    zIndex: 2,
                                  },
                                  mr: 1.5,
                                }}
                              >
                                <Avatar
                                  alt="Example team member"
                                  src={notification.avatar}
                                  sx={{ height: 40, width: 40 }}
                                />
                              </Badge>
                            </Stack>
                            <Box sx={{ flex: 1, ml: 1, mt: 0.5 }}>
                              <Typography
                                variant="body2"
                                sx={{ color: 'text.secondary', lineClamp: 2 }}
                              >
                                {notification.detail}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {notification.time}
                              </Typography>
                            </Box>
                          </Stack>
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                )
              );
            })}
            {notifications.length === 0 && (
              <Typography sx={{ p: 3 }} color="text.secondary">
                No notifications
              </Typography>
            )}
          </SimpleBar>
        </Box>
        <Stack direction="row" sx={{ justifyContent: 'center', alignItems: 'center', py: 1 }}>
          <Button
            variant="text"
            color="primary"
            disabled={!unread}
            onClick={() => {
              setNotifications((current) =>
                current.map((notification) => ({ ...notification, read: true })),
              );
            }}
          >
            Mark all as read
          </Button>
        </Stack>
      </Popover>
    </>
  );
}
