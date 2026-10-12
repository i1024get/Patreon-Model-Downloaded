# Date scopes for Designer Updates

Install BOTH archives. Extract 3dhub-date-scopes.zip into your 3DHub repository, preserving paths. Extract patreon-extension-1.2.0.zip over the existing Patreon extension folder, preserving the Chrome extension ID.

Deploy the app update. On each Windows computer used for scanning, run from the updated 3DHub repository:

.\desktop-agent\install.ps1

Then open chrome://extensions and click Reload on Patreon Model Downloader. Reopen its dashboard and Connect to 3DHub. Existing pairing remains valid if the extension ID and 3DHub origin are unchanged. If either changed, rerun desktop-agent/install-patreon-bridge.ps1.

Designer Updates offers Last 7 days (default), Last 14 days, Last 30 days, Since last successful check, and Full scan. Since last successful check falls back to seven days until a successful check has been recorded. It uses the check START timestamp so posts published during a scan remain eligible next time. Failed checks do not advance the watermark. Dates are UTC timestamps; UI labels use the browser's local timezone.

Patreon applies the cutoff during post discovery, before opening posts with known older dates. Creator feeds stop at the boundary only when newest-first sorting is confirmed and visible non-pinned dates agree with that order. Collections have no ordering guarantee and are enumerated fully, but older dated posts are not opened. Unknown publication dates are retained and may need inspection. Dates come from visible date metadata and Patreon Next.js post bootstrap data. On an opened unknown-date post, the publication date is checked before downloading.

Recent Patreon checks concern publication dates, not guaranteed changes to old posts. Use Full scan to discover new attachments added to older posts. Existing local manifest and known-attachment behavior is preserved. Older extensions cannot silently ignore a scoped request: the agent requires the date-scope capability handshake.

MakerWorld enumerates lightweight listing pages and skips old model detail requests using available publication/update metadata. Unknown dates are retained. It does not assume collections or creator API responses are sorted. Scoped results do not replace the existing complete catalog cache. Manifest/download-history matching remains unchanged.

Last-check summaries remain browser-local. Existing summaries from before this update do not have a successful-scope watermark, so they initially use the seven-day fallback.

Validation: 1088 Python tests and 31 subtests passed. Extension core, runner, manifest, and date-scope suites passed, including date extraction against a saved real Patreon page. App source/transport/due-window Node suites and Python/JavaScript syntax checks passed. Live Windows installation and logged-in scoped scans were not run here.

3DHub git commands:

git add desktop-agent/agent.py desktop-agent/patreon_bridge.py ui/index.html ui/static/js/features/designer-updates.js ui/static/js/features/patreon-download-jobs.js tests/test_download_date_scope.py tests/test_designer_updates.py DESIGNER_UPDATE_SCOPES.md
git commit -m "Add date scopes to designer update scans"
git push

Patreon extension git commands (from its own repository):

git add core.mjs runner.mjs bridge.mjs manifest.json scope-tests.mjs DATE_SCOPE_SETUP.md
git commit -m "Limit Patreon scans by publication date"
git push
