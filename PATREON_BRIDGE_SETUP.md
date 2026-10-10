# Patreon scan connection

This update adds “Scan for new models” to saved Patreon download sources in the designer’s Links section. It uses your logged-in Patreon Chrome session, downloads missing attachments, and moves completed models and images into Unsorted/<designer>. Existing manual downloads still work. MakerWorld stays in the shared source list with its existing download workflow.

## Install once

1. Extract the 3DHub patch into your existing 3DHub repository, preserving the folder structure. Commit and deploy it using your normal deployment process.
2. Extract the extension ZIP into your existing Patreon extension repository/folder (the files are at the ZIP root). Reload it at chrome://extensions. Keep the existing folder so Chrome retains its extension ID. Accept the native messaging permission if Chrome asks.
3. On the Windows computer running Chrome, reinstall/update the Desktop Agent by running desktop-agent/install.ps1 from the updated 3DHub checkout. The new agent version is 1.24.
4. Run desktop-agent/install-patreon-bridge.ps1. It asks for the extension ID shown in chrome://extensions and your exact 3DHub origin, such as https://hub.example.com (no page path). Or supply them explicitly:

```powershell
.\desktop-agent\install-patreon-bridge.ps1 -ExtensionId "YOUR_EXTENSION_ID" -HubOrigin "https://YOUR_3DHUB_HOST"
```

5. Open the Patreon extension dashboard and click Connect to 3DHub. Keep that dashboard open while scanning. Sign in to Patreon in the same Chrome profile. Chrome must be allowed to save downloads without asking for a location for every file.

## Use

Open /business/designers, edit the designer, and open Links. Save/assign the Patreon source first, then click Scan for new models. Progress and Stop appear in that section. Stop finishes the current download; completed files are transferred. Scan again to retry or find attachments added to older posts.

The agent automatically moves completed files from Chrome’s uniquely named staging folder to Unsorted/<designer>. Run the normal Unsorted scan/import afterward. The manifest supplies the Patreon identities and image associations. Existing destination files are preserved; name collisions receive a suffix. Locked posts report a failure for that post. A sign-in or security challenge pauses the run for you to handle in Chrome.

No Patreon cookies or signed attachment URLs are sent to 3DHub. The installer pairs one Chrome extension ID and one website origin. If either changes, rerun the bridge installer.

## Git commands

After extracting the app patch into your actual 3DHub checkout:

```powershell
git status --short
git add api/download_sources.py desktop-agent/agent.py desktop-agent/install.ps1 desktop-agent/install-patreon-bridge.ps1 desktop-agent/patreon_bridge.py desktop-agent/patreon_native_host.py desktop-agent/patreon_manifest.py ui/index.html ui/static/js/features/designer-download-sources.js ui/static/js/features/patreon-download-jobs.js tests/patreon_download_jobs.cjs tests/test_patreon_bridge.py tests/test_patreon_bridge_context.py tests/test_patreon_native_host.py PATREON_BRIDGE_BUILD.md docs/superpowers/plans/2026-10-10-patreon-bridge.md docs/superpowers/specs/2026-10-10-patreon-bridge.md
git commit -m "Connect Patreon scans to designer download sources"
git push
```

After extracting the extension ZIP into C:\Projects\Patreon_Model_Downloader:

```powershell
cd C:\Projects\Patreon_Model_Downloader
git status --short
git add manifest.json dashboard.html dashboard.mjs bridge.mjs runner.mjs runner-tests.mjs PATREON_BRIDGE_SETUP.md
git commit -m "Add native 3DHub scan and download connection"
git push
```

## Validation

43 Python unit checks passed, including authentication, queueing, metadata context, failed-copy cleanup, idempotent retries, and asynchronous transfer/heartbeat checks. App Node checks passed for the transport, shared sources, MakerWorld sources, atomic designer save, and due-date filter. Extension extraction, manifest, and runner suites passed, including manual-folder isolation and Chrome’s actual resumed filenames. Python compilation and JavaScript syntax checks passed.

The full pytest suite could not run because pytest is absent in this environment. Live Windows native registration, Chrome permission handling, and a real Patreon-to-Unsorted transfer still need the first on-device smoke test.
