# Strict publication scope (v1.7.0)

- Last N days = 1 uses a rolling 24-hour cutoff, frozen at batch start.
- Scoped feed and collection checks use listing publication dates before opening post pages. They never open the oldest posts merely to discover dates.
- Undated feed boundaries get three bounded metadata-hydration retries. If dates remain unreadable, the check stops expanding the feed, reviews verified current posts, and reports partial results. All time is available for deliberately inspecting undated posts.
- Collections may enumerate their listing cards because their ordering is not guaranteed; only verified in-scope posts are opened.
- An individual post source uses a metadata-only HTML request with a 15-second timeout before navigation. Sign-in redirects and security verification become incomplete results, not broader scans.
- Publication dates cross the bridge as numeric timestamps. Scoped selected downloads retain their review's cutoff and verified dates.
- Unverified dates are counted separately from confirmed older posts and prevent a false complete status.
- All time and ZIP once-only history remain available. Scope changes never rewrite queued/running jobs.

Update 3DHub, reinstall/restart Desktop Agent v1.40, reload extension v1.7.0, reopen its dashboard and reconnect. Stop older jobs and run a fresh check. Live Chrome/Patreon validation remains necessary after installation; DOM fixtures and simulated metadata responses cannot establish that every creator exposes readable listing dates.

## Listing metadata repair (v1.7.1)

The listing reader now joins Next.js Flight chunks before parsing them and reads
UTF-8 byte-length-framed text records containing post JSON. Previously these
formats were silently skipped, leaving cards with date-only labels unresolved.
Exact post IDs still determine which timestamp belongs to each card. Date-only,
missing, malformed and truncated metadata remains unresolved; scoped checks never
open undated posts to discover their dates.

After merging, pull the extension repository, reload it in Chrome, reopen the
dashboard and reconnect. Confirm version 1.7.1 and run a fresh scoped check.
Run all offline checks with `for test in *tests.mjs; do node "$test" || exit 1; done`.
Live Patreon validation is still required: fixtures verify the supported Flight
formats, not the current markup of every creator feed.

## Relative listing labels (v1.7.2)

Rendered creator feeds can expose publication dates only as `Yesterday` or
`4 days ago`, without a precise timestamp on the publication link. After the
existing hydration retries, scoped feeds now use the same metadata-only HTML
lookup already used by individual post sources. Scoped collections use it after
listing enumeration. The lookup reads the requested post's canonical publication
metadata without navigating to the post or inspecting attachments.

Each unresolved post is attempted once per run, with a maximum of 40 metadata
requests and the existing 15-second request timeout. Known dates need no lookup.
A missing/failed lookup remains unresolved and prevents expanding an undated feed
boundary. Sign-in/security failures stop the scan. All time remains unchanged.
Only an exact, verified timestamp can pass the rolling cutoff; relative labels
are not converted to invented precise timestamps.

Regression tests cover feed and collection resolution, older/unknown exclusion,
partial counts, stop/security behavior, request caching/budget, and All time.
The rendered feed establishes the missing listing metadata; signed-in validation
of the metadata-only post response remains necessary after installation.
