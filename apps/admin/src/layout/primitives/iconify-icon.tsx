import { sxArray } from '../../theme/sx.js';
import { useId } from 'react';
import { Icon, type IconProps } from '@iconify/react';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { icons, type ShellIcon } from './icons.js';

type IconifyProps = Omit<IconProps, 'icon' | 'color'> & {
  icon: ShellIcon;
  sx?: SxProps<Theme>;
  color?: string;
};

export default function IconifyIcon({ icon, color, sx = [], ...rest }: IconifyProps) {
  const id = useId();
  return (
    <Box
      component={Icon}
      className={`iconify ${icon.replace(':', '-')}`}
      {...rest}
      icon={icons[icon]}
      id={id}
      ssr
      sx={[{ color, verticalAlign: 'baseline' }, ...sxArray(sx)]}
    />
  );
}
