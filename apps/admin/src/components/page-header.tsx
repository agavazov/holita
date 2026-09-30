// Aurora ecommerce PageHeader and PageBreadcrumb, with application router links.
import { Breadcrumbs, Link, Paper, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';

export function PageHeader({
  title,
  breadcrumbs,
  action,
  embedded = false,
}: {
  title: string;
  breadcrumbs: readonly { label: string; to?: string }[];
  action?: ReactNode;
  embedded?: boolean;
}) {
  return (
    <Paper sx={embedded ? { outline: 0, mb: 4 } : { px: { xs: 3, md: 5 }, py: 3 }}>
      <Stack
        direction={{ sm: 'row' }}
        sx={{
          gap: 2,
          alignItems: { sm: 'flex-end' },
          justifyContent: 'space-between',
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 1, overflowWrap: 'anywhere' }}>
            {breadcrumbs.map(({ label, to }, index) =>
              to ? (
                <Link
                  key={index}
                  component={RouterLink}
                  to={to}
                  variant="body2"
                  sx={{ fontWeight: 'medium' }}
                >
                  {label}
                </Link>
              ) : (
                <Typography
                  key={index}
                  variant="body2"
                  aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}
                  sx={{ color: 'text.primary', fontWeight: 'medium' }}
                >
                  {label}
                </Typography>
              ),
            )}
          </Breadcrumbs>
          <Typography
            component="h1"
            variant="h4"
            sx={{ fontSize: { xs: 'h5.fontSize', lg: 'h4.fontSize' } }}
          >
            {title}
          </Typography>
        </div>
        {action}
      </Stack>
    </Paper>
  );
}
