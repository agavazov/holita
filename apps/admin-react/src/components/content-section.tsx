// Aurora section headings and the existing Product/Tag form composition.
import { Box, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import { useId, type ReactNode } from 'react';

function isSxArray(
  value: SxProps<Theme> | undefined,
): value is Extract<SxProps<Theme>, readonly unknown[]> {
  return Array.isArray(value);
}

export function ContentSection({
  title,
  description,
  children,
  sx,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  sx?: SxProps<Theme>;
}) {
  const id = useId();
  return (
    <Stack
      component="section"
      aria-labelledby={id}
      sx={[{ gap: 3, minWidth: 0 }, ...(isSxArray(sx) ? sx : [sx ?? {}])]}
    >
      <Box>
        <Typography id={id} variant="h6" component="h2" sx={{ mb: description ? 1 : 0 }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        )}
      </Box>
      {children}
    </Stack>
  );
}
