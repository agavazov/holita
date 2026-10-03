import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Link,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { ContentSection } from '../../../components/content-section.js';
import IconifyIcon from '../../../layout/primitives/iconify-icon.js';

export function BodyExamples() {
  const [notice, setNotice] = useState('');
  return (
    <Paper sx={{ p: { xs: 3, md: 5 } }}>
      <Stack divider={<Divider />} sx={{ gap: 5 }}>
        <ContentSection
          title="Typography & body"
          description="Use theme typography for headings, body copy, hints and metadata."
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 4 }}>
            <Stack sx={{ gap: 2 }}>
              {(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).map((variant) => (
                <Box key={variant}>
                  <Typography variant="caption" color="text.secondary">
                    {variant.toUpperCase()}
                  </Typography>
                  <Typography variant={variant} component="p">
                    A clear heading
                  </Typography>
                </Box>
              ))}
            </Stack>
            <Stack sx={{ gap: 3 }}>
              <Typography variant="subtitle1">A subtitle introduces the content below.</Typography>
              <Typography variant="body1">
                Body text explains what the user can do and provides the context they need to make a
                decision.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Secondary text supports the main content without competing with it.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Caption · Updated a moment ago
              </Typography>
              <Typography variant="overline">Section label</Typography>
              <Typography
                component="blockquote"
                variant="body1"
                sx={{ m: 0, pl: 3, borderLeft: 3, borderColor: 'primary.main' }}
              >
                Keep related information together and make the next action clear.
              </Typography>
              <Link
                component="button"
                underline="hover"
                onClick={() => {
                  setNotice('Text link activated.');
                }}
              >
                Preview a text link
              </Link>
            </Stack>
          </Box>
        </ContentSection>
        <ContentSection
          title="Cards & details"
          description="Group related content with Paper, ContentSection and theme spacing."
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            <Paper variant="outlined" background={1} sx={{ p: 3, borderRadius: 2 }}>
              <Stack sx={{ gap: 2 }}>
                <Typography variant="subtitle1">Example summary</Typography>
                <Chip
                  label="Active"
                  color="success"
                  variant="soft"
                  sx={{ alignSelf: 'flex-start' }}
                />
                <Typography variant="body2" color="text.secondary">
                  Use a card for a short summary or a group of related details.
                </Typography>
                <Box
                  component="dl"
                  sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1.5 }}
                >
                  <Typography component="dt" variant="body2" color="text.secondary">
                    Store
                  </Typography>
                  <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                    holita Sofia
                  </Typography>
                  <Typography component="dt" variant="body2" color="text.secondary">
                    Visibility
                  </Typography>
                  <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                    Published
                  </Typography>
                </Box>
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
              <List disablePadding aria-label="Example activity">
                {['Example created', 'Details updated', 'Ready for review'].map((label, index) => (
                  <ListItem key={label} disableGutters>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.lighter', color: 'primary.main' }}>
                        {index + 1}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={label} secondary="Local activity example" />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Box>
        </ContentSection>
        <ContentSection
          title="Buttons, badges & tooltips"
          description="Use contained for the primary action, soft for secondary actions and error for destructive actions."
        >
          <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<IconifyIcon icon="material-symbols:add-rounded" />}
              onClick={() => {
                setNotice('Primary action activated.');
              }}
            >
              Primary action
            </Button>
            <Button
              variant="soft"
              color="neutral"
              onClick={() => {
                setNotice('Secondary action activated.');
              }}
            >
              Secondary action
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setNotice('Outlined action activated.');
              }}
            >
              Outlined
            </Button>
            <Button
              variant="text"
              onClick={() => {
                setNotice('Text action activated.');
              }}
            >
              Text action
            </Button>
            <Button
              variant="soft"
              color="error"
              onClick={() => {
                setNotice('Destructive action previewed.');
              }}
            >
              Destructive
            </Button>
            <Button variant="contained" disabled>
              Disabled
            </Button>
            <Button variant="contained" loading aria-label="Pending action">
              Pending
            </Button>
            <Tooltip title="Example settings">
              <Button
                shape="circle"
                color="neutral"
                variant="soft"
                aria-label="Example settings"
                onClick={() => {
                  setNotice('Settings action activated.');
                }}
              >
                <IconifyIcon icon="material-symbols:settings-outline-rounded" />
              </Button>
            </Tooltip>
          </Stack>
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            <Chip label="Active" color="success" variant="soft" />
            <Chip label="Draft" color="neutral" variant="soft" />
            <Chip label="Needs attention" color="warning" variant="soft" />
            <Chip label="Unavailable" color="error" variant="soft" />
            <Chip label="Information" color="info" variant="soft" />
            <Chip label="Outlined badge" variant="outlined" />
          </Stack>
        </ContentSection>
        <ContentSection
          title="Summary table"
          description="Use a simple MUI table for compact readonly summaries; the list tab demonstrates interactive DataGrid behavior."
        >
          <TableContainer>
            <Table size="small" aria-label="Example summary">
              <TableHead>
                <TableRow>
                  <TableCell>Metric</TableCell>
                  <TableCell align="right">Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[
                  { label: 'Total examples', value: 12 },
                  { label: 'Active examples', value: 8 },
                  { label: 'Draft examples', value: 4 },
                ].map((row) => (
                  <TableRow key={row.label}>
                    <TableCell component="th" scope="row">
                      {row.label}
                    </TableCell>
                    <TableCell align="right">{row.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </ContentSection>
        <ContentSection
          title="Expandable content"
          description="Keep optional supporting details in a keyboard-accessible disclosure."
        >
          <Box>
            <Accordion>
              <AccordionSummary aria-controls="catalog-detail-content" id="catalog-detail-heading">
                <Typography>More details</Typography>
              </AccordionSummary>
              <AccordionDetails id="catalog-detail-content">
                <Typography variant="body2">
                  Use a disclosure for supplementary information. Required fields and errors should
                  remain easy to find.
                </Typography>
              </AccordionDetails>
            </Accordion>
            <Accordion disabled>
              <AccordionSummary>
                <Typography>Unavailable details</Typography>
              </AccordionSummary>
            </Accordion>
          </Box>
        </ContentSection>
      </Stack>
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={4000}
        onClose={() => {
          setNotice('');
        }}
      >
        <Alert
          severity="success"
          onClose={() => {
            setNotice('');
          }}
        >
          {notice}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
