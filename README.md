# Patreon Model Downloader — Chrome extension

Uses your regular Chrome profile and existing Patreon login. No Python, separate Chrome window, Google sign-in popup, remote-debugging flag, or cookie export is needed.

## Install once

1. Extract the ZIP into a permanent folder. Keep the extracted files there while the extension is installed.
2. In your normal Chrome, open **chrome://extensions**.
3. Turn on **Developer mode** at the upper right.
4. Click **Load unpacked** and choose the extracted **Patreon_Model_Downloader** folder containing `manifest.json`.
5. Open the Chrome Extensions (puzzle-piece) menu and click **Patreon Model Downloader**. Pin it if desired. Its dashboard opens as a normal tab.
6. In another tab in the same Chrome profile, open Patreon and confirm the creator posts you want to download are unlocked.
7. Click **Start / Resume** in the downloader dashboard. Keep that tab open until finished. Start with **Trial run** checked to process two posts before running the full batch.

This is a locally installed extension, not a Chrome Web Store listing. No Git commands or 3DHub deployment are needed. Replace the extracted files and click Reload on chrome://extensions when installing an update.

## Destination

By default the files are saved to **TheDuckVault** under Chrome's current download location — normally `Downloads\TheDuckVault`.

To save directly into your existing Unsorted designer folder:

1. Open **Chrome Settings → Downloads**.
2. Set **Location** to your **Unsorted root** (the parent of TheDuckVault).
3. Turn off **Ask where to save each file before downloading** so a save dialog doesn't appear for every file.
4. Leave the extension's **Download subfolder** set to **TheDuckVault**.

These settings affect other Chrome downloads too. You can restore them after the batch finishes. Alternatively, keep the default download location and move the downloaded files into `Unsorted\TheDuckVault` together afterward. Chrome's download API accepts paths relative to the configured download location, not arbitrary absolute paths.

## What it does

- Uses an existing collection tab when available; otherwise opens that collection in a normal tab using the same logged-in Chrome profile.
- Clicks **Load More** automatically until all posts are discovered. Posts are deduplicated by ID, and the discovered count is compared with the displayed collection total. A mismatch stops before downloading.
- Opens one work tab and processes posts sequentially.
- Downloads every visible `.3mf` attachment and the first/main gallery image. STL files and videos are skipped.
- Names files with the Patreon post ID to avoid unrelated models sharing a filename. The main image matches the first model's filename stem. With multiple 3MFs, all are saved and only the main image gets saved once.
- Displays per-post results and remembers download IDs and progress in Chrome's local extension storage. Signed attachment/image URLs are not stored in that progress record.
- **Stop after current file** finishes the active download, retains progress, and stops before starting the next file.
- **Start / Resume** skips completed post IDs even after their files are moved or imported, or Chrome download history is cleared. Incomplete posts are retried. Existing files are not overwritten: Chrome adds a numbered suffix on collisions.
- **Save progress report** exports the local progress as JSON for troubleshooting. It contains filenames, post IDs, statuses, and error messages, not login cookies or saved attachment URLs.

## Limits

Run one downloader dashboard at a time. A second active run is refused. Closing the dashboard stops its controller; any already-started Chrome download can continue and its stored ID is checked when you resume. The extension must stay installed to retain its progress.

Download MIME type, nonempty size, and Chrome completion status are checked. This extension does not inspect the contents of the 3MF ZIP archive. A response identified as HTML/text/JSON is reported as a failure and is not marked complete. Chrome can retain that failed response on disk; inspect it in Downloads.

Completed IDs stay in extension storage after import/moving files or clearing Chrome download history. Removing the extension or clearing its storage loses that history. Files downloaded earlier by other tools are not automatically linked to this extension's post history.

Posts without 3MFs are counted separately. Locked posts are reported as failures; the extension does not unlock paid content. It stops on a sign-in or security verification page, retains the work tab for diagnosis, and does not bypass site restrictions or solve challenges.

A successful run depends on Patreon retaining its observed page structure. The code was grounded in the supplied unlocked Captain America HTML and the collection's visible Load More/post links. Live operation in your signed-in Chrome has not been tested here.

## Permissions

- Read/interact with **www.patreon.com** pages to load the collection and find attachments and gallery images.
- **Downloads** to initiate downloads and check their status/existence for resuming.
- **Local storage** to keep progress.
- **Scripting** to inspect Patreon page content and click its Load More button.

There is no cookies permission, no access to all websites, no credential collection, no browser fingerprint modifications, and no external service receiving your history. Browser-native download requests use the Chrome session's applicable cookies.

## Verification

Run with Node.js:

```text
node tests.mjs
node runner-tests.mjs
```

Offline checks cover title/attachment/image extraction, safe names and URLs, model/image output names, rejection of HTML responses, pagination, full-batch downloads, resume without repeated downloads, completed-ID retention after import, count mismatches, and keeping signed URLs out of stored progress. The tests use browser API fixtures; they do not establish that live Patreon downloads succeed.

Reference APIs:
- https://developer.chrome.com/docs/extensions/reference/api/scripting
- https://developer.chrome.com/docs/extensions/reference/api/downloads

## Creator post feeds (v1.0.4)
The URL field also accepts https://www.patreon.com/c/javier3d/posts and other /c/<creator>/posts feeds. Set the download subfolder to the creator name before starting. The scanner scrolls the feed or clicks Load More, deduplicates pinned posts, and finishes after ten idle seconds with no loading indicator. Feeds have no verified total count; confirm the discovered count looks reasonable. Visible locked posts can be discovered but require your account to have attachment access. Trial run still scans the feed before processing two posts. Keep the Patreon feed and dashboard open.

## Completed post IDs
The extension keeps Patreon post IDs as persistent completion records. Existing completed history is retained when you reload the same installed extension. A completed post is skipped even if its downloaded files have moved. Incomplete downloads still use Chrome download records to resume. Save the progress report for a portable record of post IDs; report import and 3DHub database integration are not implemented. Completion records do not detect newly added attachments on previously completed posts.

## Development
No build step or npm dependencies are required. Run the offline checks with Node.js:

```sh
node tests.mjs
node runner-tests.mjs
```

Load this repository folder as an unpacked Chrome extension. After pulling updates, click Reload in chrome://extensions and reopen the dashboard. Keep the same installed extension and folder to retain downloaded post history.

Commit source files only. Downloaded models, progress reports, and account credentials do not belong in the repository.

## Import manifest (v1.0.5)
After each run, including stopped or partially failed runs, the extension downloads `patreon-download-manifest.json` into the selected designer folder. It replaces the previous manifest in that folder, rebuilding it from all retained download history for that folder. The **Save import manifest** button exports existing history without scanning or downloading models. Export manifests before uninstalling or clearing extension storage.

Schema version 1 records provider, designer folder, post ID/title/public URL, known source URLs, completion date/status, and each model's attachment identity, original name, relative filename, status, and matching completed image filename. Multiple 3MFs share the post's main image. No signed URLs or absolute computer paths are exported. Designer folder is a label, not a 3DHub designer database ID.

New model downloads record the numeric `m` identifier from Patreon's file URL as an attachment ID. Existing history lacks that value and exports an explicitly labeled original-filename fallback; it is not equivalent to a verified attachment ID. Previously completed files remain skipped, so generating a manifest does not upgrade those old identities. Duplicate original names may need manual reconciliation in the future importer.

The manifest is import metadata; **3DHub does not read it yet**. Its future importer should consume only completed resources and distinguish incomplete posts. Model/image filenames are relative to the manifest's folder, including Chrome's final collision-renamed filenames. History for already moved/imported files is deliberately retained; a missing file should be handled by the importer. Existing history with no saved source URL exports an empty source list unless rescanned.

Run `node manifest-tests.mjs` alongside the existing offline checks. Automatic export happens at run end; if the dashboard/Chrome closes abruptly, use Save import manifest after reopening to refresh the file. Manifest saving errors are reported separately in the dashboard.
