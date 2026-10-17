# Transport, authentication and pagination

Sources: [vendor helper](source/help.js.txt), [vendor fields](source/endpoints.js.txt),
[KarmaClient](../../../../apps/karma-client/src/cars/karma-client.ts),
[eData query/encoding](../../../../apps/karma-client/src/edata/edata-query.ts),
[history query/encoding](../../../../apps/karma-client/src/history/history-query.ts).

## Two independent sessions

The browser authenticates to holita and sends its captured bearer token to Gateway.
Gateway forwards Authorization to Karma Client. The subgraph verifies the HMAC and
expiry before its concrete services validate inputs or contact Karma. It derives
Tenant identity from that signed session, not a caller-selected Tenant header.
The current demo protocol allows Tenant selection without real user membership;
the Karma account user/role records do not supply that missing authorization.

The subgraph separately authenticates to the configured Karma account with
`POST /login`, JSON `{ "user": "<username>", "password": "<password>" }`.
The success field is `session_id`. `KARMA_USER` and `KARMA_PASSWORD` stay on the
server, as does the returned session. The configurable API base is `KARMA_API_URL`,
defaulting to `https://karma.online/apiv2/`; see the root
[environment reference](../../../../.env.example). Runtime base-URL validation
permits HTTP/HTTPS but rejects embedded credentials, query strings and fragments.

One `KarmaClient` instance holds the session and pending-login promise in memory.
Concurrent callers share a pending login; successful reads reuse the session.
There is no saved session, upstream account selector, per-Tenant credential store,
proactive refresh timer or provider logout call. A process restart loses the session.
Provider expiry duration and concurrent-session limits are not documented here.

Every fixed authenticated read sends `karma_sid` in the query and requests JSON.
It never returns the token to GraphQL. Upstream `/version` bypasses Karma login,
but its holita service still verifies the signed admin session.

## Expired sessions and deadlines

The read loop permits two attempts. HTTP 401, or a successful HTTP response whose
JSON object has `error: "Not logged in"`, invalidates the rejected session and
allows one retry with renewed authentication. Invalidation checks the exact rejected
session so an older concurrent response cannot discard a newer session.

Other HTTP failures, business-error objects, malformed JSON and incompatible
response structures do not trigger an unlimited login loop. Non-success bodies
are cancelled before parsing. Redirects use `redirect: 'error'` and are rejected.

A four-second AbortSignal bounds each client operation, including authentication
and renewal. Location, trips, events and driving profile explicitly share that
same signal through car-existence checks and subsequent reads; trip lookahead
uses it too. The version read also has a four-second bound. Gateway's subgraph
timeout is five seconds. Separate GraphQL fields or frontend car/detail reads
are separate operations, not one shared page-wide four-second budget.

Pending authentication shares its initiating request's signal. The implementation
does not give each waiter an independent login lifetime. There is no retry/backoff
for arbitrary network failures, circuit breaker, rate-limit scheduler or streaming
response-size limit. Row-count checks for some histories run after JSON parsing.

## Wire encoding and vendor-helper limitations

The vendor helper puts GET/DELETE data, including `karma_sid`, in the query. Other
methods use a JSON body and body `karma_sid`. The reconstructed schema models
GET/DELETE with an API-key security scheme. Body-authenticated methods instead
declare required body `karma_sid` and `x-authentication`; their empty OpenAPI
`security` array does not mean the vendor operation is public. `/login` is public.

Most HTML input values become strings, even when controls are marked `number`.
Multi-value fields become arrays. The helper automatically changes a GET to POST
when collecting an array, including entries such as `/edata`, `/parameters` and
`/queue/{id}` that are declared GET-only. Its generated cURL output also offers
POST forms for GET requests. Those helper behaviors do not prove server support
for the additional methods.

`{id}` is substituted from the first populated field encountered by the helper.
For normal car/driver forms that is the ID field. The queue form marks its path
ID as multi-value; an accepted multi-ID path grammar is not established.

Holita uses fixed GET paths and `URLSearchParams`. It sends scalar `car` and
repeated bracketed `fields[]`, `parameter_id[]` and `event_type[]` where applicable.
The reconstructed GET parameter models include this scalar `car` form as well as
the vendor's multi-value form; a multi-value control does not require an array in
the current single-car requests.
The public helper's generic repeated-key handling is not a complete encoding
specification. No arbitrary upstream path or field selection is exposed by GraphQL.

## Dates, coordinates and metrics

| Context         | Holita input                                  | Upstream encoding                          | Interpretation                                        |
| --------------- | --------------------------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| eData           | Paired optional `YYYY-MM-DDTHH:MM:SSZ`        | Space-separated dates plus `date_type=utc` | UTC filtering against `edt`                           |
| Events          | Paired optional `YYYY-MM-DDTHH:MM:SSZ`        | Space-separated dates plus `date_type=utc` | UTC filtering against `edt`                           |
| Trips           | Paired optional `YYYY-MM-DDTHH:MM:SS`         | Space-separated dates; no `date_type`      | Provider wall-clock zone unresolved                   |
| Driving profile | Required `fromDate` and `toDate`, without `Z` | Space-separated dates; no `date_type`      | Provider wall-clock zone unresolved                   |
| Location        | No exposed period                             | No date parameters                         | Last-known message, not proof of current connectivity |

Both date endpoints must be supplied together and ordered for optional periods.
Input parsing rejects invalid calendar dates, offsets, fractional seconds and
noncanonical forms. Equal endpoints are accepted locally; provider interval
inclusivity and overlap semantics are not fully established. No maximum period
length is enforced by the current adapter.

Returned timestamps remain raw pattern-checked strings. No implicit browser
conversion is applied. `pdt` is preserved without assigning a meaning or timezone.
Metric names such as `spd`, `odo`, duration, distance, score and weight retain source
values; units, scales, reset behavior and derived business thresholds are unresolved.

eData rejects out-of-range latitude/longitude. Location preserves any finite
coordinates for inspection, while the frontend map link requires both coordinates
within latitude ±90 / longitude ±180. Zero coordinates are valid. Trip/event
coordinate mappers require finite numbers but do not enforce geographic bounds.

## Histories and cursors

Histories are not conventional upstream page-number APIs. The help declares ID and
date bounds but no limit/offset/count/sort parameter. Current eData/events reads
accept at most 500 rows and expect ascending unique IDs. Samples also show ascending
trip IDs, but the provider trip batch cap remains unspecified. A short batch does
not establish a complete trip history.

Holita returns newest-first `items`, `cursor`, `nextCursor` and `hasMore`, using
25/50/100 displayed rows, default 50. There is no history total. `cursor` reopens the
current upper bound; `nextCursor` opens the older page. Next-page bounds set inclusive
`to_id = last displayed ID - 1`, using `message_id` for events/eData and `trip_id`
for trips. This advances by displayed rows, not by dropping the rest of a 500-row
upstream batch.

The cursor is base64url JSON with version, normalized scope, upper bound (`before`)
and initial high ID (`snapshot`). Scope binds truck, page size, normalized filters
and, for trips/events, history kind. Positive safe IDs, a maximum cursor length of
2048 and snapshot/bound consistency are validated. Parameter/event lists are
deduplicated and numerically sorted; at most 25 submitted values are accepted,
including duplicates before normalization. Parameter IDs must be positive;
event codes may be zero.

Cursors are encoded, **not signed or encrypted**. They are navigation state, not
authorization tokens; the signed admin session is still required. The snapshot
is an upper-ID bound, not a transactional database snapshot. It excludes newer
higher IDs on continuation, but cannot freeze edits/deletions of old records,
late arrivals with lower IDs or changes to active trips.

eData/events use one batch and set `hasMore` when more than the displayed page size
was returned. Trips additionally perform at most one older lookahead when the first
nonempty result has no surplus rows and its last ID exceeds 1. If older rows exist,
the response exposes their current-page cursor as `nextCursor`; it does not merge
them into the current page. Consequently a trip page can be short and still offer
Older. No whole-history scan occurs inside one operation.

Responses reject mismatched car IDs, duplicate/unordered IDs and violations of the
cursor bounds. eData/events also reject ignored date/parameter/event filters. Trip
response mapping does not re-check date inclusion because the source's trip interval
semantics are not established; it still checks identities/order/ID bounds.

The browser stores the cursor/filter/size in URL state and keeps a trail of previous
page metadata in browser history for Newer. A separately opened cursor URL or a
language change may lack that trail; Latest is available. Filter/page changes retire
old reads. Same-query Refresh retains previous successful data on failure.

## Error boundary

An HTTP 200 is not sufficient to establish success: the provider can return an
error object instead of an array. Each response mapper validates its expected
shape. Most upstream failures become the same public message,
`Karma is unavailable; try again later`, with GraphQL `SERVICE_UNAVAILABLE` and
request correlation. Local validation becomes `BAD_USER_INPUT`; missing/invalid
admin sessions become `UNAUTHENTICATED`. Upstream URLs, credentials and session
values are not exposed. See the
[error formatter](../../../../apps/karma-client/src/graphql/errors.ts).

Car detail accepts an empty array or HTTP 404 as missing. Location/profile return
null for a missing car or empty endpoint array; trips/events return empty pages
after a missing-car precheck. eData does not perform a car-existence precheck in
its backend method; its page separately loads the car before the history. Calling
`karmaEdata` directly therefore depends on `/edata` behavior for an unknown car.

The external API's complete status codes, error payloads, rate-limit signals,
correlation identifiers and support diagnostics remain undocumented. Holita's
sanitized boundary should not be mistaken for a complete provider error contract.
