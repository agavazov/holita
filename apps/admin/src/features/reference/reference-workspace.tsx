import { Alert, Paper, Skeleton, Snackbar, Typography } from '@mui/material';
import { lazy, Suspense, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router';
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
  const [notice, setNotice] = useState('');
  const { pathname } = useLocation();
  return (
    <>
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={6000}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setNotice('');
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
      <Routes key={pathname}>
        {['events/:eventId/sessions/create', 'events/:eventId/sessions/:sessionId/edit'].map(
          (path) => (
            <Route
              key={path}
              path={path}
              element={
                <SessionRoute
                  storeId={storeId}
                  onSaved={() => {
                    setNotice('Session saved.');
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
                setNotice('Event moved to trash.');
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
                      Loading event editor…
                    </Typography>
                    <Skeleton variant="rounded" height={300} />
                  </Paper>
                }
              >
                <EventEditor
                  storeId={storeId}
                  onSaved={() => {
                    setNotice('Event saved.');
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
                setNotice('Event updated.');
              }}
              onDeleted={() => {
                setNotice('Event moved to trash.');
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
                setNotice(count === 1 ? 'Venue deleted.' : `${String(count)} venues deleted.`);
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
                  setNotice('Venue saved.');
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
                setNotice(count === 1 ? 'Speaker deleted.' : `${String(count)} speakers deleted.`);
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
                  setNotice('Speaker saved.');
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
                setNotice(count === 1 ? 'Tag deleted.' : `${String(count)} tags deleted.`);
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
                  setNotice('Tag saved.');
                }}
              />
            }
          />
        ))}

        <Route path="*" element={<Navigate to={`/stores/${storeId}/reference/events`} replace />} />
      </Routes>
    </>
  );
}
