import { Alert, Paper, Skeleton, Snackbar, Typography } from '@mui/material';
import { lazy, Suspense, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router';
import type { TranslationKey } from '../../localization/dictionaries.js';
import { useLocalization } from '../../localization/localization-provider.js';
import { localizedPath, semanticRouteKey } from '../../localization/locale.js';
import { SessionEditor } from './sessions/session-editor.js';
import { EventShow } from './events/event-show.js';
import { EventList } from './events/event-list.js';
import { VenueEditor } from './venues/venue-editor.js';
import { VenueList } from './venues/venue-list.js';
import { SpeakerEditor } from './speakers/speaker-editor.js';
import { SpeakerList } from './speakers/speaker-list.js';
import { TagEditor } from './tags/tag-editor.js';
import { TagList } from './tags/tag-list.js';

// Tiptap is needed only while editing an Event, not for lists, Products or other forms.
const EventEditor = lazy(async () => {
  const module = await import('./events/event-editor.js');
  return { default: module.EventEditor };
});

function SessionRoute({ storeId, onSaved }: { storeId: string; onSaved: () => void }) {
  const { eventId, sessionId } = useParams();
  return eventId ? (
    <SessionEditor
      storeId={storeId}
      eventId={eventId}
      {...(sessionId ? { sessionId } : {})}
      onSaved={onSaved}
    />
  ) : null;
}
export function ReferenceWorkspace({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [notice, setNotice] = useState<{
    key: TranslationKey;
    values?: Readonly<Record<string, string | number>>;
  } | null>(null);
  const { pathname } = useLocation();
  const { locale, t } = useLocalization();
  return (
    <>
      <Snackbar
        open={notice !== null}
        autoHideDuration={6000}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setNotice(null);
        }}
      >
        <Alert
          severity="success"
          onClose={() => {
            setNotice(null);
          }}
        >
          {notice ? t(notice.key, notice.values) : null}
        </Alert>
      </Snackbar>
      <Routes key={semanticRouteKey(pathname)}>
        {['events/:eventId/sessions/create', 'events/:eventId/sessions/:sessionId/edit'].map(
          (path) => (
            <Route
              key={path}
              path={path}
              element={
                <SessionRoute
                  storeId={storeId}
                  onSaved={() => {
                    setNotice({ key: 'reference.sessionSaved' });
                  }}
                />
              }
            />
          ),
        )}
        <Route
          path="events"
          element={
            <EventList
              storeId={storeId}
              storeName={storeName}
              onDeleted={() => {
                setNotice({ key: 'reference.eventTrashed' });
              }}
            />
          }
        />
        {['events/create', 'events/:eventId/edit'].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <Suspense
                fallback={
                  <Paper sx={{ p: { xs: 3, md: 5 }, flex: 1 }}>
                    <Typography role="status" sx={{ mb: 3 }}>
                      {t('reference.loadingEventEditor')}
                    </Typography>
                    <Skeleton variant="rounded" height={300} />
                  </Paper>
                }
              >
                <EventEditor
                  storeId={storeId}
                  onSaved={() => {
                    setNotice({ key: 'reference.eventSaved' });
                  }}
                />
              </Suspense>
            }
          />
        ))}
        <Route
          path="events/:eventId"
          element={
            <EventShow
              storeId={storeId}
              onChanged={() => {
                setNotice({ key: 'reference.eventUpdated' });
              }}
              onDeleted={() => {
                setNotice({ key: 'reference.eventTrashed' });
              }}
            />
          }
        />

        <Route
          path="venues"
          element={
            <VenueList
              storeId={storeId}
              onDeleted={(count) => {
                setNotice(
                  count === 1
                    ? { key: 'reference.venueDeletedOne' }
                    : { key: 'reference.venueDeletedMany', values: { count } },
                );
              }}
            />
          }
        />
        {['venues/create', 'venues/:venueId/edit'].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <VenueEditor
                storeId={storeId}
                onSaved={() => {
                  setNotice({ key: 'reference.venueSaved' });
                }}
              />
            }
          />
        ))}

        <Route
          path="speakers"
          element={
            <SpeakerList
              storeId={storeId}
              onDeleted={(count) => {
                setNotice(
                  count === 1
                    ? { key: 'reference.speakerDeletedOne' }
                    : { key: 'reference.speakerDeletedMany', values: { count } },
                );
              }}
            />
          }
        />
        {['speakers/create', 'speakers/:speakerId/edit'].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <SpeakerEditor
                storeId={storeId}
                onSaved={() => {
                  setNotice({ key: 'reference.speakerSaved' });
                }}
              />
            }
          />
        ))}

        <Route
          path="tags"
          element={
            <TagList
              storeId={storeId}
              onDeleted={(count) => {
                setNotice(
                  count === 1
                    ? { key: 'reference.tagDeletedOne' }
                    : { key: 'reference.tagDeletedMany', values: { count } },
                );
              }}
            />
          }
        />
        {['tags/create', 'tags/:tagId/edit'].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <TagEditor
                storeId={storeId}
                onSaved={() => {
                  setNotice({ key: 'reference.tagSaved' });
                }}
              />
            }
          />
        ))}

        <Route
          path="*"
          element={
            <Navigate to={localizedPath(locale, `/stores/${storeId}/reference/events`)} replace />
          }
        />
      </Routes>
    </>
  );
}
