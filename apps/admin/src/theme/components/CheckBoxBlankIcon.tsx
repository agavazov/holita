import { sxArray } from '../sx.js';
import { SvgIcon, type SvgIconProps } from '@mui/material';

const CheckBoxBlankIcon = ({ sx, ...rest }: SvgIconProps) => {
  return (
    <SvgIcon sx={[{ fill: 'transparent' }, ...sxArray(sx)]} {...rest}>
      <rect x="0.5" y="0.5" width="15" height="15" rx="3.5" stroke="currentColor" />
    </SvgIcon>
  );
};

export default CheckBoxBlankIcon;
