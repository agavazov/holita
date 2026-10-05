import { Avatar, type AvatarProps, badgeClasses } from '@mui/material';
import OutlinedBadge from './outlined-badge.js';
export default function StatusAvatar(props: AvatarProps) {
  return (
    <OutlinedBadge
      overlap="circular"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      variant="dot"
      color="success"
      sx={{ [`& .${badgeClasses.badge}`]: { height: 10, width: 10, borderRadius: '50%' } }}
    >
      <Avatar {...props} />
    </OutlinedBadge>
  );
}
