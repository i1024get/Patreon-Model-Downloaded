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
